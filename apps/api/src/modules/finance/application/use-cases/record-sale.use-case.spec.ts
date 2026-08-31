import { RecordSaleUseCase } from './record-sale.use-case';
import { CalculateOrderPricingUseCase } from './calculate-order-pricing.use-case';
import type { IFeePolicyRepository } from '../../domain/ports/fee-policy.repository.port';
import type { IOrderPricingSnapshotRepository } from '../../domain/ports/order-pricing-snapshot.repository.port';
import type { ILedgerRepository } from '../../domain/ports/ledger.repository.port';
import type { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import type { FeePolicy } from '../../domain/entities/fee-policy.entity';
import type { LedgerAccount } from '../../domain/entities/ledger-account.entity';
import type { ILogger } from '../../../../shared/kernel/logger.port';

function makePolicy(overrides: Partial<FeePolicy> = {}): FeePolicy {
  return {
    id: 'policy-1',
    organizationId: null,
    platformFeeBps: 500,
    processingFeeBps: 100,
    buyerFeeBps: 0,
    refundFeePolicy: 'RETAIN',
    settlementDelayDays: 7,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAccount(id: string, code: string): LedgerAccount {
  return { id, code, name: code, accountType: 'ASSET', organizationId: null, currency: 'BRL', createdAt: new Date() };
}

const makeFeeRepo = (): jest.Mocked<IFeePolicyRepository> => ({
  findActive: jest.fn(),
});

const makeSnapshotRepo = (): jest.Mocked<IOrderPricingSnapshotRepository> => ({
  findByOrderId: jest.fn(),
  create: jest.fn().mockResolvedValue(undefined),
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
  upsertIncrementPending: jest.fn().mockResolvedValue(undefined),
  decrementPendingIncrementAvailable: jest.fn(),
  decrementAvailable: jest.fn(),
  decrementPending: jest.fn(),
  incrementReserved: jest.fn(),
  decrementReserved: jest.fn(),
});

describe('RecordSaleUseCase', () => {
  let useCase: RecordSaleUseCase;
  let feePolicyRepo: jest.Mocked<IFeePolicyRepository>;
  let snapshotRepo: jest.Mocked<IOrderPricingSnapshotRepository>;
  let ledgerRepo: jest.Mocked<ILedgerRepository>;
  let sellerBalanceRepo: jest.Mocked<ISellerBalanceRepository>;

  const clearingAccount = makeAccount('acc-clearing', 'PLATFORM_CLEARING');
  const revenueAccount = makeAccount('acc-revenue', 'PLATFORM_REVENUE');
  const payableAccount = makeAccount('acc-payable', 'SELLER_PAYABLE:org-1');

  beforeEach(() => {
    feePolicyRepo = makeFeeRepo();
    snapshotRepo = makeSnapshotRepo();
    ledgerRepo = makeLedgerRepo();
    sellerBalanceRepo = makeSellerBalanceRepo();

    ledgerRepo.findAccountByCode.mockImplementation(async (code) => {
      if (code === 'PLATFORM_CLEARING') return clearingAccount;
      if (code === 'PLATFORM_REVENUE') return revenueAccount;
      return null;
    });
    ledgerRepo.findOrCreateOrgAccount.mockResolvedValue(payableAccount);

    const logger: ILogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    useCase = new RecordSaleUseCase(
      feePolicyRepo,
      snapshotRepo,
      ledgerRepo,
      sellerBalanceRepo,
      new CalculateOrderPricingUseCase(),
      logger,
    );
  });

  describe('happy path — with platform and processing fees', () => {
    beforeEach(() => {
      feePolicyRepo.findActive.mockResolvedValue(makePolicy({ platformFeeBps: 500, processingFeeBps: 100 }));
    });

    it('creates a pricing snapshot with calculated fee amounts', async () => {
      // gross=10000, platform=500 bps=500, processing=100 bps=100, sellerNet=9400
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(snapshotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          grossAmount: 10000n,
          platformFeeAmount: 500n,
          processingFeeAmount: 100n,
          sellerNetAmount: 9400n,
        }),
        undefined,
      );
    });

    it('records a ledger transaction with DEBIT clearing, CREDIT payable, CREDIT revenue', async () => {
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'ORDER_PAID',
          sourceId: 'order-1',
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: clearingAccount.id, entryType: 'DEBIT', amount: 10000n }),
            expect.objectContaining({ accountId: payableAccount.id, entryType: 'CREDIT', amount: 9400n }),
            expect.objectContaining({ accountId: revenueAccount.id, entryType: 'CREDIT', amount: 600n }),
          ]),
        }),
        undefined,
      );
    });

    it('increments seller pending balance by sellerNetAmount', async () => {
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(sellerBalanceRepo.upsertIncrementPending).toHaveBeenCalledWith('org-1', 'BRL', 9400n, undefined);
    });
  });

  describe('policy without platform fee (0 bps)', () => {
    it('does not add PLATFORM_REVENUE credit entry when total platform fee is zero', async () => {
      feePolicyRepo.findActive.mockResolvedValue(makePolicy({ platformFeeBps: 0, processingFeeBps: null }));

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.findAccountByCode).not.toHaveBeenCalledWith('PLATFORM_REVENUE', expect.anything());

      const calls = ledgerRepo.recordTransaction.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const call = calls[0]![0];
      const revenueEntry = call.entries.find((e: { accountId: string }) => e.accountId === revenueAccount.id);
      expect(revenueEntry).toBeUndefined();
    });
  });

  describe('policy fallback', () => {
    it('uses org-specific policy when available', async () => {
      const orgPolicy = makePolicy({ id: 'org-policy', organizationId: 'org-1', platformFeeBps: 300 });
      feePolicyRepo.findActive
        .mockResolvedValueOnce(orgPolicy);

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(feePolicyRepo.findActive).toHaveBeenCalledWith('org-1');
      expect(snapshotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ feePolicyId: 'org-policy' }),
        undefined,
      );
    });

    it('falls back to global policy when org-specific policy is not found', async () => {
      const globalPolicy = makePolicy({ id: 'global-policy', organizationId: null });
      feePolicyRepo.findActive
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(globalPolicy);

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(feePolicyRepo.findActive).toHaveBeenNthCalledWith(1, 'org-1');
      expect(feePolicyRepo.findActive).toHaveBeenNthCalledWith(2);
      expect(snapshotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ feePolicyId: 'global-policy' }),
        undefined,
      );
    });
  });

  describe('error cases', () => {
    it('throws when no policy is found (neither org nor global)', async () => {
      feePolicyRepo.findActive.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' }),
      ).rejects.toThrow('No active fee policy found');
    });

    it('throws when PLATFORM_CLEARING account does not exist', async () => {
      feePolicyRepo.findActive.mockResolvedValue(makePolicy({ platformFeeBps: 500 }));
      ledgerRepo.findAccountByCode.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' }),
      ).rejects.toThrow('PLATFORM_CLEARING account not found');
    });
  });

  describe('passes transaction client through', () => {
    it('forwards tx to all repository calls', async () => {
      const tx = { txMarker: true } as unknown;
      feePolicyRepo.findActive.mockResolvedValue(makePolicy({ platformFeeBps: 500, processingFeeBps: 0 }));

      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL', tx });

      expect(snapshotRepo.create).toHaveBeenCalledWith(expect.anything(), tx);
      expect(sellerBalanceRepo.upsertIncrementPending).toHaveBeenCalledWith('org-1', 'BRL', expect.any(BigInt), tx);
      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(expect.anything(), tx);
    });
  });

  describe('buyer fee (buyerFeeBps > 0)', () => {
    beforeEach(() => {
      feePolicyRepo.findActive.mockResolvedValue(
        makePolicy({ platformFeeBps: 500, processingFeeBps: 100, buyerFeeBps: 200 }),
      );
    });

    it('persists buyerFeeBps and buyerFeeAmount in the pricing snapshot', async () => {
      // gross=10000, buyerFee=200 bps → 200
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(snapshotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buyerFeeBps: 200,
          buyerFeeAmount: 200n,
        }),
        undefined,
      );
    });

    it('debits PLATFORM_CLEARING by gross + buyerFee', async () => {
      // gross=10000, buyerFee=200 → DEBIT=10200
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: clearingAccount.id, entryType: 'DEBIT', amount: 10200n }),
          ]),
        }),
        undefined,
      );
    });

    it('credits PLATFORM_REVENUE with platformFee + processingFee + buyerFee', async () => {
      // platformFee=500, processingFee=100, buyerFee=200 → CREDIT REVENUE=800
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: revenueAccount.id, entryType: 'CREDIT', amount: 800n }),
          ]),
        }),
        undefined,
      );
    });

    it('credits SELLER_PAYABLE only by sellerNet (buyer fee does not inflate seller revenue)', async () => {
      // sellerNet = 10000 - 500 - 100 = 9400 (buyerFee excluded)
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ accountId: payableAccount.id, entryType: 'CREDIT', amount: 9400n }),
          ]),
        }),
        undefined,
      );
    });

    it('ledger is double-entry balanced: DEBIT clearing == CREDIT payable + CREDIT revenue', async () => {
      // DEBIT = gross + buyerFee = 10200
      // CREDIT = sellerNet + platformFee + processingFee + buyerFee = 9400 + 800 = 10200
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });
      const lastCall = ledgerRepo.recordTransaction.mock.calls.at(-1)![0];
      const entries: Array<{ entryType: string; amount: bigint }> = lastCall.entries;
      const totalDebit = entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + e.amount, 0n);
      const totalCredit = entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n);
      expect(totalDebit).toBe(totalCredit);
    });

    it('seller pending balance incremented by sellerNet only (buyer fee excluded)', async () => {
      await useCase.execute({ orderId: 'order-1', organizationId: 'org-1', grossAmount: 10000n, currency: 'BRL' });

      expect(sellerBalanceRepo.upsertIncrementPending).toHaveBeenCalledWith('org-1', 'BRL', 9400n, undefined);
    });
  });
});
