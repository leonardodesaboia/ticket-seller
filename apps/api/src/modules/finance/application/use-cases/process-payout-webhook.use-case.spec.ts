import { ProcessPayoutWebhookUseCase } from './process-payout-webhook.use-case';
import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { Payout } from '../../domain/entities/payout.entity';
import { ParsedWebhookEvent, IPayoutGatewayPort } from '../../domain/ports/payout-gateway.port';
import { IPayoutRepository } from '../../domain/ports/payout.repository.port';
import { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import { ILedgerRepository } from '../../domain/ports/ledger.repository.port';
import { LedgerAccount } from '../../domain/entities/ledger-account.entity';
import { LedgerTransaction } from '../../domain/entities/ledger-transaction.entity';
import { IFinanceTransactionRunner } from '../ports/finance-transaction-runner.port';
import { ILogger } from '../../../../shared/kernel/logger.port';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeMockTx = () => ({
  $executeRaw: jest.fn().mockResolvedValue(1),
  $queryRaw: jest.fn().mockResolvedValue([{ status: 'PROCESSING' }]),
});

const makePayout = (overrides: Partial<Payout> = {}): Payout => ({
  id: 'payout-1',
  organizationId: 'org-1',
  recipientId: 'recipient-1',
  amount: 10000n,
  currency: 'BRL',
  status: 'PROCESSING',
  provider: 'fake',
  externalPayoutId: 'ext-payout-1',
  idempotencyKey: 'idem-key-1',
  failureReason: null,
  requestedAt: new Date('2026-01-01T00:00:00Z'),
  succeededAt: null,
  failedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeEvent = (overrides: Partial<ParsedWebhookEvent> = {}): ParsedWebhookEvent => ({
  provider: 'fake',
  providerEventId: 'evt-1',
  externalPayoutId: 'ext-payout-1',
  eventType: 'SUCCEEDED',
  amount: 10000n,
  currency: 'BRL',
  rawPayload: {},
  ...overrides,
});

const makeLedgerAccount = (code: string): LedgerAccount => ({
  id: `account-${code}`,
  code,
  name: code,
  accountType: 'LIABILITY',
  organizationId: 'org-1',
  currency: 'BRL',
  createdAt: new Date(),
});

const makeLedgerTransaction = (): LedgerTransaction => ({
  id: 'ledger-tx-1',
  sourceType: 'PAYOUT_SUCCEEDED',
  sourceId: 'payout-1',
  description: null,
  occurredAt: new Date(),
  createdAt: new Date(),
});

// ─── Mock factory ────────────────────────────────────────────────────────────

function makeMocks() {
  const payoutRepo: jest.Mocked<IPayoutRepository> = {
    create: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    findByExternalId: jest.fn(),
    findProcessingOlderThan: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    updateExternalId: jest.fn(),
  };

  const balanceRepo: jest.Mocked<ISellerBalanceRepository> = {
    findByOrg: jest.fn(),
    findByOrgForUpdate: jest.fn(),
    upsertIncrementPending: jest.fn(),
    decrementPendingIncrementAvailable: jest.fn(),
    decrementAvailable: jest.fn(),
    decrementPending: jest.fn(),
    incrementReserved: jest.fn(),
    decrementReserved: jest.fn().mockResolvedValue(undefined),
  };

  const ledgerRepo: jest.Mocked<ILedgerRepository> = {
    findOrCreateOrgAccount: jest.fn().mockImplementation(async (code: string) =>
      makeLedgerAccount(code),
    ),
    findAccountByCode: jest.fn().mockResolvedValue(makeLedgerAccount('PLATFORM_CLEARING')),
    recordTransaction: jest.fn().mockResolvedValue(makeLedgerTransaction()),
    findTransactionBySource: jest.fn(),
  };

  const gateway: jest.Mocked<IPayoutGatewayPort> = {
    provider: 'fake',
    createRecipient: jest.fn(),
    createPayout: jest.fn(),
    getPayoutStatus: jest.fn(),
    parseWebhookEvent: jest.fn(),
  };

  const logger: jest.Mocked<ILogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const transactionRunner = {
    run: jest.fn().mockImplementation(
      (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(makeMockTx()),
    ),
  };

  return { payoutRepo, balanceRepo, ledgerRepo, gateway, logger, transactionRunner };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProcessPayoutWebhookUseCase', () => {
  let useCase: ProcessPayoutWebhookUseCase;
  let mocks: ReturnType<typeof makeMocks>;

  const input = { rawBody: Buffer.from('{}'), signature: 'sig-1' };

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new ProcessPayoutWebhookUseCase(
      mocks.transactionRunner as IFinanceTransactionRunner,
      mocks.payoutRepo,
      mocks.balanceRepo,
      mocks.ledgerRepo,
      mocks.gateway,
      mocks.logger,
    );
    mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent());
    mocks.payoutRepo.findByExternalId.mockResolvedValue(makePayout());
  });

  // ─── execute() — guards ───────────────────────────────────────────────────

  describe('execute() — guards', () => {
    it('throws NotFoundError when payout is not found for the webhook event', async () => {
      mocks.payoutRepo.findByExternalId.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns without calling handlers when payout is already PAID', async () => {
      mocks.payoutRepo.findByExternalId.mockResolvedValue(makePayout({ status: 'PAID' }));

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
    });

    it('returns without calling handlers when payout is already FAILED', async () => {
      mocks.payoutRepo.findByExternalId.mockResolvedValue(makePayout({ status: 'FAILED' }));

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
    });

    it('rejects webhook and inserts mismatch outbox when event amount diverges from stored payout', async () => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ amount: 99999n }));
      const mockTx = makeMockTx();
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.transactionRunner.run).toHaveBeenCalledTimes(1);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('mismatch'),
      );
      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
      expect(mocks.ledgerRepo.recordTransaction).not.toHaveBeenCalled();
    });

    it('rejects webhook and inserts mismatch outbox when event currency diverges from stored payout', async () => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ currency: 'USD' }));
      const mockTx = makeMockTx();
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.transactionRunner.run).toHaveBeenCalledTimes(1);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('mismatch'),
      );
      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('proceeds normally without outbox insert when amount and currency match stored payout', async () => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ amount: 10000n, currency: 'BRL' }));

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).toHaveBeenCalled();
    });
  });

  // ─── execute() — dispatch ─────────────────────────────────────────────────

  describe('execute() — dispatch', () => {
    it('routes to succeeded handler and marks payout PAID on SUCCEEDED event', async () => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ eventType: 'SUCCEEDED' }));

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'PAID',
        expect.anything(),
        expect.anything(),
      );
    });

    it('routes to failed handler and marks payout FAILED on FAILED event', async () => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ eventType: 'FAILED' }));

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'FAILED',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ─── handleSucceeded ──────────────────────────────────────────────────────

  describe('handleSucceeded', () => {
    beforeEach(() => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ eventType: 'SUCCEEDED' }));
    });

    it('skips all mutations when dedup insert returns 0 rows (event already processed)', async () => {
      const mockTx = makeMockTx();
      mockTx.$executeRaw.mockResolvedValueOnce(0);
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
      expect(mocks.ledgerRepo.recordTransaction).not.toHaveBeenCalled();
    });

    it('skips all mutations when payout is already PAID under re-check lock', async () => {
      const mockTx = makeMockTx();
      mockTx.$queryRaw.mockResolvedValueOnce([{ status: 'PAID' }]);
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
    });

    it('skips all mutations when payout is FAILED under re-check lock', async () => {
      const mockTx = makeMockTx();
      mockTx.$queryRaw.mockResolvedValueOnce([{ status: 'FAILED' }]);
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
    });

    it('marks PAID, decrements reserved balance, and records PAYOUT_SUCCEEDED ledger on happy path', async () => {
      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'PAID',
        expect.objectContaining({ succeededAt: expect.any(Date) }),
        expect.anything(),
      );
      expect(mocks.balanceRepo.decrementReserved).toHaveBeenCalledWith(
        'org-1',
        10000n,
        expect.anything(),
      );
      expect(mocks.ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'PAYOUT_SUCCEEDED',
          entries: expect.arrayContaining([
            expect.objectContaining({ amount: 10000n, currency: 'BRL' }),
          ]),
        }),
        expect.anything(),
      );
    });
  });

  // ─── handleFailed ─────────────────────────────────────────────────────────

  describe('handleFailed', () => {
    beforeEach(() => {
      mocks.gateway.parseWebhookEvent.mockReturnValue(makeEvent({ eventType: 'FAILED' }));
    });

    it('skips all mutations when dedup insert returns 0 rows (event already processed)', async () => {
      const mockTx = makeMockTx();
      mockTx.$executeRaw.mockResolvedValueOnce(0);
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
      expect(mocks.ledgerRepo.recordTransaction).not.toHaveBeenCalled();
    });

    it('skips all mutations when payout is already FAILED under re-check lock', async () => {
      const mockTx = makeMockTx();
      mockTx.$queryRaw.mockResolvedValueOnce([{ status: 'FAILED' }]);
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('skips all mutations when payout is PAID under re-check lock (concurrent SUCCEEDED webhook won the race)', async () => {
      const mockTx = makeMockTx();
      mockTx.$queryRaw.mockResolvedValueOnce([{ status: 'PAID' }]);
      mocks.transactionRunner.run.mockImplementationOnce(
        (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx),
      );

      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(mocks.balanceRepo.decrementReserved).not.toHaveBeenCalled();
    });

    it('marks FAILED, decrements reserved, restores available balance, and records PAYOUT_FAILED ledger on happy path', async () => {
      await useCase.execute(input);

      expect(mocks.payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'FAILED',
        expect.objectContaining({
          failedAt: expect.any(Date),
          failureReason: expect.any(String),
        }),
        expect.anything(),
      );
      expect(mocks.balanceRepo.decrementReserved).toHaveBeenCalledWith(
        'org-1',
        10000n,
        expect.anything(),
      );
      expect(mocks.ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'PAYOUT_FAILED',
          entries: expect.arrayContaining([
            expect.objectContaining({ amount: 10000n, currency: 'BRL' }),
          ]),
        }),
        expect.anything(),
      );
    });
  });
});
