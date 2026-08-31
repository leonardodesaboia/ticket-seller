import { Test } from '@nestjs/testing';
import type PgBoss from 'pg-boss';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PAYOUT_REPOSITORY, type IPayoutRepository } from '../../domain/ports/payout.repository.port';
import { SELLER_BALANCE_REPOSITORY, type ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import { LEDGER_REPOSITORY, type ILedgerRepository } from '../../domain/ports/ledger.repository.port';
import { PAYOUT_GATEWAY_PORT, type IPayoutGatewayPort } from '../../domain/ports/payout-gateway.port';
import { PG_BOSS } from '../../../../platform/scheduling/pgboss.module';
import { ReconciliationWorker } from './reconciliation.worker';

describe('ReconciliationWorker', () => {
  let worker: ReconciliationWorker;
  let boss: {
    createQueue: jest.MockedFunction<PgBoss['createQueue']>;
    schedule: jest.MockedFunction<PgBoss['schedule']>;
    work: jest.Mock<Promise<string>, [string, () => Promise<void>]>;
  };
  let prisma: { $transaction: jest.Mock; $executeRaw: jest.Mock };
  let payoutRepo: jest.Mocked<Pick<IPayoutRepository, 'updateStatus'>>;
  let balanceRepo: jest.Mocked<Pick<ISellerBalanceRepository, 'decrementReserved'>>;
  let ledgerRepo: jest.Mocked<Pick<ILedgerRepository, 'findOrCreateOrgAccount' | 'findAccountByCode' | 'recordTransaction'>>;
  let gateway: jest.Mocked<Pick<IPayoutGatewayPort, 'getPayoutStatus'>>;
  let pollFn: () => Promise<void>;

  // Raw DB row format (snake_case) returned by fetchStuckPayouts
  const baseRawRow = {
    id: 'payout-1',
    organization_id: 'org-1',
    recipient_id: 'recipient-1',
    amount: 10000n,
    currency: 'BRL',
    status: 'PROCESSING',
    provider: 'fake',
    external_payout_id: 'ext-payout-1' as string | null,
    idempotency_key: 'idem-key-1',
    failure_reason: null,
    requested_at: new Date('2026-01-01T00:00:00Z'),
    succeeded_at: null,
    failed_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
  const rawRow = (overrides: Partial<typeof baseRawRow> = {}) => ({
    ...baseRawRow,
    ...overrides,
  });

  const makeMockTx = (statusOverride = 'PROCESSING') => ({
    $queryRaw: jest.fn().mockResolvedValue([{ status: statusOverride }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  });

  beforeEach(async () => {
    boss = {
      createQueue: jest.fn<Promise<void>, Parameters<PgBoss['createQueue']>>().mockResolvedValue(undefined),
      schedule: jest.fn<Promise<void>, Parameters<PgBoss['schedule']>>().mockResolvedValue(undefined),
      work: jest.fn<Promise<string>, [string, () => Promise<void>]>().mockResolvedValue('handler-id'),
    };
    prisma = {
      $transaction: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    payoutRepo = { updateStatus: jest.fn().mockResolvedValue(undefined) };
    balanceRepo = { decrementReserved: jest.fn().mockResolvedValue(undefined) };
    ledgerRepo = {
      findOrCreateOrgAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
      findAccountByCode: jest.fn().mockResolvedValue({ id: 'platform-clearing-1' }),
      recordTransaction: jest.fn().mockResolvedValue(undefined),
    };
    gateway = { getPayoutStatus: jest.fn() };

    boss.work.mockImplementation((_jobName: string, handler: () => Promise<void>) => {
      pollFn = handler;
      return Promise.resolve('handler-id');
    });

    const mod = await Test.createTestingModule({
      providers: [
        ReconciliationWorker,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYOUT_REPOSITORY, useValue: payoutRepo },
        { provide: SELLER_BALANCE_REPOSITORY, useValue: balanceRepo },
        { provide: LEDGER_REPOSITORY, useValue: ledgerRepo },
        { provide: PAYOUT_GATEWAY_PORT, useValue: gateway },
        { provide: PG_BOSS, useValue: boss },
      ],
    }).compile();

    worker = mod.get(ReconciliationWorker);
    await worker.onModuleInit();
  });

  describe('onModuleInit', () => {
    let freshWorker: ReconciliationWorker;
    let freshBoss: {
      createQueue: jest.MockedFunction<PgBoss['createQueue']>;
      schedule: jest.MockedFunction<PgBoss['schedule']>;
      work: jest.Mock<Promise<string>, [string, () => Promise<void>]>;
    };

    beforeEach(async () => {
      freshBoss = {
        createQueue: jest.fn<Promise<void>, Parameters<PgBoss['createQueue']>>().mockResolvedValue(undefined),
        schedule: jest.fn<Promise<void>, Parameters<PgBoss['schedule']>>().mockResolvedValue(undefined),
        work: jest.fn<Promise<string>, [string, () => Promise<void>]>().mockResolvedValue('handler-id'),
      };

      const mod = await Test.createTestingModule({
        providers: [
          ReconciliationWorker,
          { provide: PrismaService, useValue: { $transaction: jest.fn(), $executeRaw: jest.fn() } },
          { provide: PAYOUT_REPOSITORY, useValue: { updateStatus: jest.fn() } },
          { provide: SELLER_BALANCE_REPOSITORY, useValue: { decrementReserved: jest.fn() } },
          {
            provide: LEDGER_REPOSITORY,
            useValue: {
              findOrCreateOrgAccount: jest.fn(),
              findAccountByCode: jest.fn(),
              recordTransaction: jest.fn(),
            },
          },
          { provide: PAYOUT_GATEWAY_PORT, useValue: { getPayoutStatus: jest.fn() } },
          { provide: PG_BOSS, useValue: freshBoss },
        ],
      }).compile();

      freshWorker = mod.get(ReconciliationWorker);
    });

    it('registers queue in createQueue → schedule → work order', async () => {
      const callOrder: string[] = [];
      freshBoss.createQueue.mockImplementation(async () => { callOrder.push('createQueue'); });
      freshBoss.schedule.mockImplementation(async () => { callOrder.push('schedule'); });
      freshBoss.work.mockImplementation(async (_name: string, _handler: () => Promise<void>) => { callOrder.push('work'); return 'handler-id'; });

      await freshWorker.onModuleInit();

      expect(callOrder).toEqual(['createQueue', 'schedule', 'work']);
    });

    it('uses reconciliation-poll job name and 15-minute UTC cron', async () => {
      await freshWorker.onModuleInit();

      expect(freshBoss.createQueue).toHaveBeenCalledWith('reconciliation-poll');
      expect(freshBoss.schedule).toHaveBeenCalledWith(
        'reconciliation-poll',
        '*/15 * * * *',
        {},
        { tz: 'UTC' },
      );
      expect(freshBoss.work).toHaveBeenCalledWith('reconciliation-poll', expect.any(Function));
    });

    it('propagates createQueue failure — schedule and work are not called', async () => {
      freshBoss.createQueue.mockRejectedValue(new Error('queue creation failed'));

      await expect(freshWorker.onModuleInit()).rejects.toThrow('queue creation failed');

      expect(freshBoss.schedule).not.toHaveBeenCalled();
      expect(freshBoss.work).not.toHaveBeenCalled();
    });

    it('propagates schedule failure — work is not called', async () => {
      freshBoss.schedule.mockRejectedValue(new Error('schedule registration failed'));

      await expect(freshWorker.onModuleInit()).rejects.toThrow('schedule registration failed');

      expect(freshBoss.work).not.toHaveBeenCalled();
    });
  });

  describe('poll', () => {
    it('returns without processing when no stuck payouts found', async () => {
      prisma.$transaction.mockResolvedValue([]);

      await expect(pollFn()).resolves.toBeUndefined();

      expect(gateway.getPayoutStatus).not.toHaveBeenCalled();
    });

    it('re-throws fetchStuckPayouts failure so pg-boss marks the job failed', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db timeout on stuck payouts query'));

      await expect(pollFn()).rejects.toThrow('db timeout on stuck payouts query');
    });

    it('absorbs individual payout reconciliation failures without stopping the batch', async () => {
      prisma.$transaction.mockResolvedValue([
        rawRow({ id: 'p-1', external_payout_id: 'ext-1' }),
        rawRow({ id: 'p-2', external_payout_id: 'ext-2' }),
      ]);
      gateway.getPayoutStatus
        .mockRejectedValueOnce(new Error('gateway unreachable for payout-1'))
        .mockResolvedValueOnce({ externalPayoutId: 'ext-2', status: 'PROCESSING' });

      await expect(pollFn()).resolves.toBeUndefined();

      expect(gateway.getPayoutStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('reconcilePayout routing', () => {
    it('skips payout without externalPayoutId — no gateway call made', async () => {
      prisma.$transaction.mockResolvedValue([rawRow({ external_payout_id: null })]);

      await pollFn();

      expect(gateway.getPayoutStatus).not.toHaveBeenCalled();
    });

    it('returns without calling handlers when gateway reports PROCESSING', async () => {
      prisma.$transaction.mockResolvedValue([rawRow()]);
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'PROCESSING',
      });

      await pollFn();

      expect(payoutRepo.updateStatus).not.toHaveBeenCalled();
      expect(balanceRepo.decrementReserved).not.toHaveBeenCalled();
    });

    it('calls handleSucceeded when gateway reports PAID', async () => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'PAID',
        amount: 10000n,
        currency: 'BRL',
      });
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'PAID',
        expect.anything(),
        expect.anything(),
      );
    });

    it('calls handleFailed when gateway reports FAILED', async () => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'FAILED',
      });
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'FAILED',
        expect.anything(),
        expect.anything(),
      );
    });

    it('inserts outbox mismatch event when gateway amount differs, then still calls handleSucceeded', async () => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'PAID',
        amount: 99999n,
        currency: 'BRL',
      });
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'PAID',
        expect.anything(),
        expect.anything(),
      );
    });

    it('inserts outbox mismatch event when gateway currency differs, then still calls handleSucceeded', async () => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'PAID',
        amount: 10000n,
        currency: 'USD',
      });
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'PAID',
        expect.anything(),
        expect.anything(),
      );
    });

    it('does not insert mismatch event when gateway omits amount', async () => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'PAID',
      });
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(payoutRepo.updateStatus).toHaveBeenCalledWith(
        'payout-1',
        'PAID',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('handleSucceeded (via poll with PAID gateway)', () => {
    beforeEach(() => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'PAID',
        amount: 10000n,
        currency: 'BRL',
      });
    });

    it('uses persisted payout.amount for balance and ledger mutations — not any gateway value', async () => {
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(balanceRepo.decrementReserved).toHaveBeenCalledWith(
        'org-1',
        10000n,
        expect.anything(),
      );
    });

    it('records ledger entry with persisted payout currency', async () => {
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(ledgerRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ amount: 10000n, currency: 'BRL' }),
          ]),
        }),
        expect.anything(),
      );
    });

    it('skips all mutations if payout is already PAID under lock', async () => {
      const mockTx = makeMockTx('PAID');
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(balanceRepo.decrementReserved).not.toHaveBeenCalled();
      expect(ledgerRepo.recordTransaction).not.toHaveBeenCalled();
    });
  });

  describe('handleFailed (via poll with FAILED gateway)', () => {
    beforeEach(() => {
      gateway.getPayoutStatus.mockResolvedValue({
        externalPayoutId: 'ext-payout-1',
        status: 'FAILED',
      });
    });

    it('uses persisted payout.amount when restoring balance and ledger on failure', async () => {
      const mockTx = makeMockTx();
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(balanceRepo.decrementReserved).toHaveBeenCalledWith(
        'org-1',
        10000n,
        expect.anything(),
      );
    });

    it('skips all mutations if payout is already FAILED under lock', async () => {
      const mockTx = makeMockTx('FAILED');
      prisma.$transaction
        .mockImplementationOnce(() => Promise.resolve([rawRow()]))
        .mockImplementation((cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => cb(mockTx));

      await pollFn();

      expect(balanceRepo.decrementReserved).not.toHaveBeenCalled();
      expect(ledgerRepo.recordTransaction).not.toHaveBeenCalled();
    });
  });
});
