import { RecordRefundUseCase } from './record-refund.use-case';
import type { IOrderPricingSnapshotRepository } from '../../domain/ports/order-pricing-snapshot.repository.port';
import type { ILedgerRepository } from '../../domain/ports/ledger.repository.port';
import type { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import type { OrderPricingSnapshot } from '../../domain/entities/order-pricing-snapshot.entity';
import type { LedgerAccount } from '../../domain/entities/ledger-account.entity';
import type { IOrderSettlementQueryPort } from '../ports/order-settlement-query.port';
import type { ILogger } from '../../../../shared/kernel/logger.port';

function makeSnapshot(overrides: Partial<OrderPricingSnapshot> = {}): OrderPricingSnapshot {
  return {
    orderId: 'order-1',
    feePolicyId: 'policy-1',
    grossAmount: 10000n,
    currency: 'BRL',
    platformFeeBps: 500,
    platformFeeAmount: 500n,
    processingFeeBps: 100,
    processingFeeAmount: 100n,
    refundFeePolicy: 'RETAIN',
    sellerNetAmount: 9400n,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeAccount(id: string, code: string): LedgerAccount {
  return { id, code, name: code, accountType: 'ASSET', organizationId: null, currency: 'BRL', createdAt: new Date() };
}

const makeSnapshotRepo = (): jest.Mocked<IOrderPricingSnapshotRepository> => ({
  findByOrderId: jest.fn(),
  create: jest.fn(),
});

const makeLedgerRepo = (): jest.Mocked<ILedgerRepository> => ({
  findAccountByCode: jest.fn(),
  findOrCreateOrgAccount: jest.fn(),
  recordTransaction: jest.fn().mockResolvedValue({ id: 'txn-1' } as any),
  findTransactionBySource: jest.fn(),
});

const makeSellerBalanceRepo = (): jest.Mocked<ISellerBalanceRepository> => ({
  findByOrg: jest.fn(),
  findByOrgForUpdate: jest.fn(),
  upsertIncrementPending: jest.fn(),
  decrementPendingIncrementAvailable: jest.fn(),
  decrementAvailable: jest.fn().mockResolvedValue(undefined),
  decrementPending: jest.fn().mockResolvedValue(undefined),
  incrementReserved: jest.fn(),
  decrementReserved: jest.fn(),
});

const makeLogger = (): jest.Mocked<ILogger> => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

function makeOrderSettlementQuery(isSettled: boolean): jest.Mocked<IOrderSettlementQueryPort> {
  return { isOrderSettled: jest.fn().mockResolvedValue(isSettled) };
}

describe('RecordRefundUseCase', () => {
  const clearingAccount = makeAccount('acc-clearing', 'PLATFORM_CLEARING');
  const revenueAccount = makeAccount('acc-revenue', 'PLATFORM_REVENUE');
  const payableAccount = makeAccount('acc-payable', 'SELLER_PAYABLE:org-1');

  let snapshotRepo: jest.Mocked<IOrderPricingSnapshotRepository>;
  let ledgerRepo: jest.Mocked<ILedgerRepository>;
  let sellerBalanceRepo: jest.Mocked<ISellerBalanceRepository>;

  function buildUseCase(isSettled = false) {
    const orderSettlementQuery = makeOrderSettlementQuery(isSettled);
    ledgerRepo.findAccountByCode.mockImplementation(async (code) => {
      if (code === 'PLATFORM_CLEARING') return clearingAccount;
      if (code === 'PLATFORM_REVENUE') return revenueAccount;
      return null;
    });
    ledgerRepo.findOrCreateOrgAccount.mockResolvedValue(payableAccount);
    return new RecordRefundUseCase(snapshotRepo, ledgerRepo, sellerBalanceRepo, orderSettlementQuery, makeLogger());
  }

  beforeEach(() => {
    snapshotRepo = makeSnapshotRepo();
    ledgerRepo = makeLedgerRepo();
    sellerBalanceRepo = makeSellerBalanceRepo();
  });

  describe('no snapshot found', () => {
    it('returns early without recording any ledger entries', async () => {
      snapshotRepo.findByOrderId.mockResolvedValue(null);
      const useCase = buildUseCase();

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).not.toHaveBeenCalled();
      expect(sellerBalanceRepo.decrementPending).not.toHaveBeenCalled();
    });
  });

  describe('RETAIN policy (producer bears fee)', () => {
    it('records DEBIT SELLER_PAYABLE and CREDIT PLATFORM_CLEARING for sellerNetAmount', async () => {
      const snapshot = makeSnapshot({ refundFeePolicy: 'RETAIN', sellerNetAmount: 9400n });
      snapshotRepo.findByOrderId.mockResolvedValue(snapshot);
      const useCase = buildUseCase();

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'REFUND',
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: payableAccount.id, entryType: 'DEBIT', amount: 9400n }),
            expect.objectContaining({ accountId: clearingAccount.id, entryType: 'CREDIT', amount: 9400n }),
          ]),
        }),
        undefined,
      );
    });

    it('decrements pending balance when order is not settled', async () => {
      snapshotRepo.findByOrderId.mockResolvedValue(makeSnapshot({ sellerNetAmount: 9400n }));
      const useCase = buildUseCase(false);

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(sellerBalanceRepo.decrementPending).toHaveBeenCalledWith('org-1', 9400n, undefined);
      expect(sellerBalanceRepo.decrementAvailable).not.toHaveBeenCalled();
    });

    it('decrements available balance when order is settled', async () => {
      snapshotRepo.findByOrderId.mockResolvedValue(makeSnapshot({ sellerNetAmount: 9400n }));
      const useCase = buildUseCase(true);

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(sellerBalanceRepo.decrementAvailable).toHaveBeenCalledWith('org-1', 9400n, undefined);
      expect(sellerBalanceRepo.decrementPending).not.toHaveBeenCalled();
    });
  });

  describe('TBD policy treated as RETAIN', () => {
    it('records sellerNet-only entries (same as RETAIN)', async () => {
      snapshotRepo.findByOrderId.mockResolvedValue(makeSnapshot({ refundFeePolicy: 'TBD', sellerNetAmount: 9400n }));
      const useCase = buildUseCase();

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: payableAccount.id, entryType: 'DEBIT', amount: 9400n }),
          ]),
        }),
        undefined,
      );
    });
  });

  describe('REFUND policy (platform refunds fee too)', () => {
    it('records gross reversal with DEBIT payable, CREDIT clearing + CREDIT revenue', async () => {
      const snapshot = makeSnapshot({
        refundFeePolicy: 'REFUND',
        grossAmount: 10000n,
        sellerNetAmount: 9400n,
        platformFeeAmount: 500n,
        processingFeeAmount: 100n,
      });
      snapshotRepo.findByOrderId.mockResolvedValue(snapshot);
      const useCase = buildUseCase();

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: payableAccount.id, entryType: 'DEBIT', amount: 10000n }),
            expect.objectContaining({ accountId: clearingAccount.id, entryType: 'CREDIT', amount: 9400n }),
            expect.objectContaining({ accountId: revenueAccount.id, entryType: 'CREDIT', amount: 600n }),
          ]),
        }),
        undefined,
      );
    });

    it('skips PLATFORM_REVENUE lookup when total platform fee is zero', async () => {
      const snapshot = makeSnapshot({
        refundFeePolicy: 'REFUND',
        platformFeeAmount: 0n,
        processingFeeAmount: 0n,
        sellerNetAmount: 10000n,
      });
      snapshotRepo.findByOrderId.mockResolvedValue(snapshot);
      const useCase = buildUseCase();

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.findAccountByCode).not.toHaveBeenCalledWith('PLATFORM_REVENUE', expect.anything());
    });
  });

  describe('PROPORTIONAL policy', () => {
    it('scales entries proportionally when refundAmount equals grossAmount', async () => {
      const snapshot = makeSnapshot({
        refundFeePolicy: 'PROPORTIONAL',
        grossAmount: 10000n,
        sellerNetAmount: 9400n,
        platformFeeAmount: 500n,
        processingFeeAmount: 100n,
      });
      snapshotRepo.findByOrderId.mockResolvedValue(snapshot);
      const useCase = buildUseCase();

      // Full refund: refundAmount === grossAmount → proportional = 1x
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 10000n, currency: 'BRL' });

      const call = ledgerRepo.recordTransaction.mock.calls[0]![0];
      const debitEntry = call.entries.find((e: { entryType: string }) => e.entryType === 'DEBIT');
      // scaledSellerNet=9400, scaledPlatformFee=600 → totalDebit=10000
      expect(debitEntry?.amount).toBe(10000n);
    });

    it('scales entries proportionally for partial refund', async () => {
      const snapshot = makeSnapshot({
        refundFeePolicy: 'PROPORTIONAL',
        grossAmount: 10000n,
        sellerNetAmount: 9400n,
        platformFeeAmount: 500n,
        processingFeeAmount: 100n,
      });
      snapshotRepo.findByOrderId.mockResolvedValue(snapshot);
      const useCase = buildUseCase();

      // Half refund: 5000/10000 = 0.5
      // scaledSellerNet = 9400*5000/10000 = 4700
      // scaledPlatformFee = 600*5000/10000 = 300
      // totalDebit = 5000
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 5000n, currency: 'BRL' });

      const call = ledgerRepo.recordTransaction.mock.calls[0]![0];
      const debitEntry = call.entries.find((e: { entryType: string }) => e.entryType === 'DEBIT');
      expect(debitEntry?.amount).toBe(5000n);

      const clearingCredit = call.entries.find((e: { accountId: string; entryType: string }) => e.accountId === clearingAccount.id && e.entryType === 'CREDIT');
      expect(clearingCredit?.amount).toBe(4700n);
    });
  });

  describe('zero sellerNetAmount in RETAIN policy', () => {
    it('does not record ledger entries and skips balance update', async () => {
      snapshotRepo.findByOrderId.mockResolvedValue(makeSnapshot({ sellerNetAmount: 0n }));
      const useCase = buildUseCase();

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', refundAmount: 0n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).not.toHaveBeenCalled();
      expect(sellerBalanceRepo.decrementPending).not.toHaveBeenCalled();
    });
  });
});
