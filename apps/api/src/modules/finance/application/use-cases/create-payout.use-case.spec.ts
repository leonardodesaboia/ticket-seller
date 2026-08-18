import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreatePayoutUseCase, InsufficientBalanceException } from './create-payout.use-case';
import { IPayoutRepository } from '../../domain/ports/payout.repository.port';
import { IPayoutRecipientRepository } from '../../domain/ports/payout-recipient.repository.port';
import { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import { ILedgerRepository } from '../../domain/ports/ledger.repository.port';
import { IPayoutGatewayPort } from '../../domain/ports/payout-gateway.port';
import { Payout } from '../../domain/entities/payout.entity';
import { PayoutRecipient } from '../../domain/entities/payout-recipient.entity';
import { SellerBalance } from '../../domain/entities/seller-balance.entity';
import { LedgerAccount } from '../../domain/entities/ledger-account.entity';
import { LedgerTransaction } from '../../domain/entities/ledger-transaction.entity';
import { PrismaService } from '../../../../platform/database/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipient(overrides: Partial<PayoutRecipient> = {}): PayoutRecipient {
  return {
    id: 'recipient-id',
    organizationId: 'org-id',
    provider: 'FAKE',
    externalRecipientId: 'fake_recipient_abc123',
    status: 'VERIFIED',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeBalance(overrides: Partial<SellerBalance> = {}): SellerBalance {
  return {
    id: 'balance-id',
    organizationId: 'org-id',
    pendingAmount: 0n,
    availableAmount: 10000n,
    reservedAmount: 0n,
    currency: 'BRL',
    version: 1,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: 'payout-id',
    organizationId: 'org-id',
    recipientId: 'recipient-id',
    amount: 5000n,
    currency: 'BRL',
    status: 'SCHEDULED',
    provider: 'FAKE',
    externalPayoutId: null,
    idempotencyKey: 'idem-key-1',
    failureReason: null,
    requestedAt: new Date(),
    succeededAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeLedgerAccount(code: string): LedgerAccount {
  return {
    id: `account-${code}`,
    code,
    name: code,
    accountType: 'LIABILITY',
    organizationId: 'org-id',
    currency: 'BRL',
    createdAt: new Date(),
  };
}

function makeLedgerTransaction(): LedgerTransaction {
  return {
    id: 'tx-id',
    sourceType: 'PAYOUT_REQUESTED',
    sourceId: 'payout-id',
    description: null,
    occurredAt: new Date(),
    createdAt: new Date(),
  };
}

// ─── Mock factory ────────────────────────────────────────────────────────────

function makeMocks() {
  const payoutRepo: jest.Mocked<IPayoutRepository> = {
    create: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    findByExternalId: jest.fn(),
    findProcessingOlderThan: jest.fn(),
    updateStatus: jest.fn(),
    updateExternalId: jest.fn(),
  };

  const recipientRepo: jest.Mocked<IPayoutRecipientRepository> = {
    findByOrg: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn(),
    updateStatus: jest.fn(),
  };

  const balanceRepo: jest.Mocked<ISellerBalanceRepository> = {
    findByOrg: jest.fn(),
    findByOrgForUpdate: jest.fn(),
    upsertIncrementPending: jest.fn(),
    decrementPendingIncrementAvailable: jest.fn(),
    decrementAvailable: jest.fn(),
    decrementPending: jest.fn(),
    incrementReserved: jest.fn(),
    decrementReserved: jest.fn(),
  };

  const ledgerRepo: jest.Mocked<ILedgerRepository> = {
    findOrCreateOrgAccount: jest.fn(),
    findAccountByCode: jest.fn(),
    recordTransaction: jest.fn(),
    findTransactionBySource: jest.fn(),
  };

  const gateway: jest.Mocked<IPayoutGatewayPort> = {
    provider: 'FAKE',
    createRecipient: jest.fn(),
    createPayout: jest.fn(),
    getPayoutStatus: jest.fn(),
    parseWebhookEvent: jest.fn(),
  };

  // The Prisma mock: $transaction receives a callback, passes a tx proxy with $executeRaw
  const txProxy = {
    $executeRaw: jest.fn().mockResolvedValue(1),
  };

  const prismaMock = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(txProxy),
    ),
  } as unknown as PrismaService;

  return { payoutRepo, recipientRepo, balanceRepo, ledgerRepo, gateway, prismaMock, txProxy };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CreatePayoutUseCase', () => {
  let useCase: CreatePayoutUseCase;
  let mocks: ReturnType<typeof makeMocks>;

  const defaultInput = {
    organizationId: 'org-id',
    amount: 5000n,
    currency: 'BRL',
    idempotencyKey: 'idem-key-1',
  };

  beforeEach(() => {
    mocks = makeMocks();
    const { payoutRepo, recipientRepo, balanceRepo, ledgerRepo, gateway, prismaMock } = mocks;

    useCase = new CreatePayoutUseCase(
      prismaMock,
      payoutRepo,
      recipientRepo,
      balanceRepo,
      ledgerRepo,
      gateway,
    );

    // Default happy-path stubs
    recipientRepo.findByOrg.mockResolvedValue(makeRecipient());
    balanceRepo.findByOrgForUpdate.mockResolvedValue(makeBalance({ availableAmount: 10000n }));
    payoutRepo.create.mockResolvedValue({ payout: makePayout(), inserted: true });
    ledgerRepo.findOrCreateOrgAccount.mockImplementation(async (code: string) =>
      makeLedgerAccount(code),
    );
    ledgerRepo.recordTransaction.mockResolvedValue(makeLedgerTransaction());
    gateway.createPayout.mockResolvedValue({
      externalPayoutId: 'fake_payout_xyz',
      status: 'PROCESSING',
    });
    payoutRepo.updateExternalId.mockResolvedValue(undefined);
  });

  describe('happy path — sufficient balance', () => {
    it('creates payout, reserves balance, records ledger, dispatches to provider', async () => {
      const result = await useCase.execute(defaultInput);

      // Recipient looked up
      expect(mocks.recipientRepo.findByOrg).toHaveBeenCalledWith('org-id');

      // Payout inserted within transaction
      expect(mocks.payoutRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-id',
          amount: 5000n,
          currency: 'BRL',
          idempotencyKey: 'idem-key-1',
          status: 'SCHEDULED',
        }),
        expect.anything(), // tx
      );

      // Ledger recorded
      expect(mocks.ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'PAYOUT_REQUESTED' }),
        expect.anything(),
      );

      // Balance reserved via raw SQL
      expect(mocks.txProxy.$executeRaw).toHaveBeenCalled();

      // Gateway called outside transaction
      expect(mocks.gateway.createPayout).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-id',
          amount: 5000n,
          currency: 'BRL',
          idempotencyKey: 'idem-key-1',
        }),
      );

      // External ID persisted
      expect(mocks.payoutRepo.updateExternalId).toHaveBeenCalledWith(
        'payout-id',
        'fake_payout_xyz',
        'PROCESSING',
      );

      // Result reflects PROCESSING status
      expect(result.status).toBe('PROCESSING');
      expect(result.externalPayoutId).toBe('fake_payout_xyz');
    });
  });

  describe('insufficient balance', () => {
    it('throws InsufficientBalanceException (422) when available < amount', async () => {
      mocks.balanceRepo.findByOrgForUpdate.mockResolvedValue(
        makeBalance({ availableAmount: 100n }),
      );

      await expect(
        useCase.execute({ ...defaultInput, amount: 5000n }),
      ).rejects.toBeInstanceOf(InsufficientBalanceException);

      // Gateway must NOT be called
      expect(mocks.gateway.createPayout).not.toHaveBeenCalled();
    });

    it('InsufficientBalanceException is a 422 UnprocessableEntityException', () => {
      const err = new InsufficientBalanceException();
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getStatus()).toBe(422);
    });
  });

  describe('recipient not verified', () => {
    it('throws UnprocessableEntityException when recipient is PENDING_VERIFICATION', async () => {
      mocks.recipientRepo.findByOrg.mockResolvedValue(
        makeRecipient({ status: 'PENDING_VERIFICATION' }),
      );

      await expect(useCase.execute(defaultInput)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );

      // Transaction must not be started
      expect(mocks.prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when no recipient exists', async () => {
      mocks.recipientRepo.findByOrg.mockResolvedValue(null);

      await expect(useCase.execute(defaultInput)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException when recipient has no externalRecipientId', async () => {
      mocks.recipientRepo.findByOrg.mockResolvedValue(
        makeRecipient({ status: 'VERIFIED', externalRecipientId: null }),
      );

      await expect(useCase.execute(defaultInput)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  describe('balance not found', () => {
    it('throws NotFoundException when no seller balance exists for org', async () => {
      mocks.balanceRepo.findByOrgForUpdate.mockResolvedValue(null);

      await expect(useCase.execute(defaultInput)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('idempotency — same idempotency_key', () => {
    it('returns existing payout without touching balance or ledger when already inserted', async () => {
      const existingPayout = makePayout({
        status: 'PROCESSING',
        externalPayoutId: 'fake_payout_existing',
      });
      mocks.payoutRepo.create.mockResolvedValue({ payout: existingPayout, inserted: false });

      const result = await useCase.execute(defaultInput);

      // Ledger and balance updates must NOT be called again
      expect(mocks.ledgerRepo.recordTransaction).not.toHaveBeenCalled();
      // $executeRaw (balance update) should not be called
      expect(mocks.txProxy.$executeRaw).not.toHaveBeenCalled();
      // Gateway must not be called again
      expect(mocks.gateway.createPayout).not.toHaveBeenCalled();

      expect(result.id).toBe(existingPayout.id);
      expect(result.status).toBe('PROCESSING');
    });
  });
});
