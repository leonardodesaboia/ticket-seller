import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { SettleOrderUseCase } from '../../application/use-cases/settle-order.use-case';
import { PG_BOSS } from '../../../../platform/scheduling/pgboss.module';

interface EligibleOrderRow {
  id: string;
  organization_id: string;
  seller_net_amount: bigint;
  currency: string;
}

@Injectable()
export class SettlementWorker implements OnModuleInit {
  private readonly logger = new Logger(SettlementWorker.name);
  private readonly chunkSize = 50;
  static readonly JOB_NAME = 'settlement-poll';

  constructor(
    private readonly prisma: PrismaService,
    private readonly settleOrder: SettleOrderUseCase,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.createQueue(SettlementWorker.JOB_NAME);
    await this.boss.schedule(SettlementWorker.JOB_NAME, '0 * * * *', {}, { tz: 'UTC' });
    await this.boss.work(SettlementWorker.JOB_NAME, () => this.poll());
    this.logger.log('SettlementWorker registered — cron 0 * * * * UTC (1h)');
  }

  private async poll(): Promise<void> {
    this.logger.log('SettlementWorker poll started');
    let processed = 0;
    try {
      let hasMore = true;
      while (hasMore) {
        const orders = await this.fetchEligibleOrders();
        if (orders.length === 0) break;

        for (const order of orders) {
          if (await this.processOrder(order)) processed++;
        }

        if (orders.length < this.chunkSize) hasMore = false;
      }
      if (processed > 0) {
        this.logger.log(`SettlementWorker poll completed — settled ${processed} order(s)`);
      }
    } catch (err) {
      this.logger.error('SettlementWorker poll error', err);
      throw err;
    }
  }

  private async fetchEligibleOrders(): Promise<EligibleOrderRow[]> {
    const client = this.prisma as unknown as PrismaClient;
    return client.$transaction((tx) =>
      tx.$queryRaw<EligibleOrderRow[]>`
        SELECT o.id, o.organization_id, ops.seller_net_amount, ops.currency
        FROM orders o
        JOIN order_pricing_snapshots ops ON ops.order_id = o.id
        JOIN events e ON e.id = o.event_id
        JOIN fee_policies fp ON fp.id = ops.fee_policy_id
        WHERE o.status = 'TICKETS_ISSUED'
          AND e.ends_at IS NOT NULL
          AND e.ends_at + (fp.settlement_delay_days || ' days')::INTERVAL <= NOW()
          AND NOT EXISTS (
            SELECT 1 FROM balance_settlements bs WHERE bs.order_id = o.id
          )
        ORDER BY o.id
        LIMIT ${this.chunkSize}
        FOR UPDATE SKIP LOCKED
      `,
    );
  }

  private async processOrder(order: EligibleOrderRow): Promise<boolean> {
    try {
      const settled = await this.settleOrder.execute({
        orderId: order.id,
        organizationId: order.organization_id,
        sellerNetAmount: order.seller_net_amount,
        currency: order.currency,
      });
      if (settled) {
        this.logger.log(
          `SettlementWorker: settled orderId=${order.id} org=${order.organization_id} amount=${order.seller_net_amount}`,
        );
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error(`SettlementWorker: failed to settle orderId=${order.id}`, err);
      return false;
    }
  }
}
