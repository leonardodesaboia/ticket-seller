import { Test } from '@nestjs/testing';
import type PgBoss from 'pg-boss';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { SettleOrderUseCase } from '../../application/use-cases/settle-order.use-case';
import { PG_BOSS } from '../../../../platform/scheduling/pgboss.module';
import { SettlementWorker } from './settlement.worker';

describe('SettlementWorker', () => {
  let worker: SettlementWorker;
  let boss: {
    createQueue: jest.MockedFunction<PgBoss['createQueue']>;
    schedule: jest.MockedFunction<PgBoss['schedule']>;
    work: jest.Mock<Promise<string>, [string, () => Promise<void>]>;
  };
  let prisma: { $transaction: jest.Mock };
  let settleOrder: jest.Mocked<Pick<SettleOrderUseCase, 'execute'>>;

  const makeOrder = (id: string) => ({
    id,
    organization_id: 'org-1',
    seller_net_amount: 10000n,
    currency: 'BRL',
  });

  beforeEach(async () => {
    boss = {
      createQueue: jest.fn<Promise<void>, Parameters<PgBoss['createQueue']>>().mockResolvedValue(undefined),
      schedule: jest.fn<Promise<void>, Parameters<PgBoss['schedule']>>().mockResolvedValue(undefined),
      work: jest.fn<Promise<string>, [string, () => Promise<void>]>().mockResolvedValue('handler-id'),
    };
    prisma = { $transaction: jest.fn().mockResolvedValue([]) };
    settleOrder = { execute: jest.fn<Promise<boolean>, Parameters<SettleOrderUseCase['execute']>>().mockResolvedValue(true) };

    const mod = await Test.createTestingModule({
      providers: [
        SettlementWorker,
        { provide: PrismaService, useValue: prisma },
        { provide: SettleOrderUseCase, useValue: settleOrder },
        { provide: PG_BOSS, useValue: boss },
      ],
    }).compile();

    worker = mod.get(SettlementWorker);
  });

  describe('onModuleInit', () => {
    it('registers queue in createQueue → schedule → work order', async () => {
      const callOrder: string[] = [];
      boss.createQueue.mockImplementation(async () => { callOrder.push('createQueue'); });
      boss.schedule.mockImplementation(async () => { callOrder.push('schedule'); });
      boss.work.mockImplementation(async (_name: string, _handler: () => Promise<void>) => { callOrder.push('work'); return 'handler-id'; });

      await worker.onModuleInit();

      expect(callOrder).toEqual(['createQueue', 'schedule', 'work']);
    });

    it('uses settlement-poll job name and hourly UTC cron', async () => {
      await worker.onModuleInit();

      expect(boss.createQueue).toHaveBeenCalledWith('settlement-poll');
      expect(boss.schedule).toHaveBeenCalledWith(
        'settlement-poll',
        '0 * * * *',
        {},
        { tz: 'UTC' },
      );
      expect(boss.work).toHaveBeenCalledWith('settlement-poll', expect.any(Function));
    });

    it('propagates createQueue failure — schedule and work are not called', async () => {
      boss.createQueue.mockRejectedValue(new Error('queue creation failed'));

      await expect(worker.onModuleInit()).rejects.toThrow('queue creation failed');

      expect(boss.schedule).not.toHaveBeenCalled();
      expect(boss.work).not.toHaveBeenCalled();
    });

    it('propagates schedule failure — work is not called', async () => {
      boss.schedule.mockRejectedValue(new Error('schedule registration failed'));

      await expect(worker.onModuleInit()).rejects.toThrow('schedule registration failed');

      expect(boss.work).not.toHaveBeenCalled();
    });

    it('propagates work registration failure', async () => {
      boss.work.mockRejectedValue(new Error('work handler registration failed'));

      await expect(worker.onModuleInit()).rejects.toThrow('work handler registration failed');
    });
  });

  describe('poll (via work callback)', () => {
    let pollFn: () => Promise<void>;

    beforeEach(async () => {
      boss.work.mockImplementation((_jobName: string, handler: () => Promise<void>) => {
        pollFn = handler;
        return Promise.resolve('handler-id');
      });
      await worker.onModuleInit();
    });

    it('returns without processing when no eligible orders found', async () => {
      prisma.$transaction.mockResolvedValue([]);

      await expect(pollFn()).resolves.toBeUndefined();

      expect(settleOrder.execute).not.toHaveBeenCalled();
    });

    it('calls settleOrder.execute for each eligible order with correct args', async () => {
      prisma.$transaction
        .mockResolvedValueOnce([makeOrder('order-1'), makeOrder('order-2')])
        .mockResolvedValue([]);

      await pollFn();

      expect(settleOrder.execute).toHaveBeenCalledTimes(2);
      expect(settleOrder.execute).toHaveBeenCalledWith({
        orderId: 'order-1',
        organizationId: 'org-1',
        sellerNetAmount: 10000n,
        currency: 'BRL',
      });
      expect(settleOrder.execute).toHaveBeenCalledWith({
        orderId: 'order-2',
        organizationId: 'org-1',
        sellerNetAmount: 10000n,
        currency: 'BRL',
      });
    });

    it('re-throws fetchEligibleOrders failure so pg-boss marks the job failed', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db connection lost'));

      await expect(pollFn()).rejects.toThrow('db connection lost');
    });

    it('absorbs individual order failures without stopping the batch', async () => {
      prisma.$transaction
        .mockResolvedValueOnce([makeOrder('order-1'), makeOrder('order-2')])
        .mockResolvedValue([]);
      settleOrder.execute
        .mockRejectedValueOnce(new Error('order-1 settlement error'))
        .mockResolvedValueOnce(true);

      await expect(pollFn()).resolves.toBeUndefined();

      expect(settleOrder.execute).toHaveBeenCalledTimes(2);
    });

    it('processes orders in chunks — stops when batch is smaller than chunkSize', async () => {
      prisma.$transaction.mockResolvedValueOnce([makeOrder('order-1'), makeOrder('order-2')]);

      await pollFn();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(settleOrder.execute).toHaveBeenCalledTimes(2);
    });
  });
});
