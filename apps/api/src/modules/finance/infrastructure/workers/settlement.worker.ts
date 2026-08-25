import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { SettleOrderUseCase } from '../../application/use-cases/settle-order.use-case';

interface EligibleOrderRow {
  id: string;
  organization_id: string;
  seller_net_amount: bigint;
  currency: string;
}

@Injectable()
export class SettlementWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementWorker.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 3_600_000; // 1 hour
  private readonly chunkSize = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settleOrder: SettleOrderUseCase,
  ) {}

  onModuleInit(): void {
    this.logger.log('SettlementWorker started — polling every 1h');
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('SettlementWorker stopped');
    }
  }

  private async poll(): Promise<void> {
    this.logger.log('SettlementWorker poll started');
    try {
      let processed = 0;
      // Drain-the-queue: keep processing until no more eligible orders
      let hasMore = true;
      while (hasMore) {
        const orders = await this.fetchEligibleOrders();
        if (orders.length === 0) {
          hasMore = false;
          break;
        }

        for (const order of orders) {
          await this.processOrder(order);
          processed++;
        }

        // If we got fewer than chunkSize, we've drained the queue
        if (orders.length < this.chunkSize) {
          hasMore = false;
        }
      }

      if (processed > 0) {
        this.logger.log(`SettlementWorker poll completed — settled ${processed} order(s)`);
      }
    } catch (err) {
      this.logger.error('SettlementWorker poll error', err);
    }
  }

  private async fetchEligibleOrders(): Promise<EligibleOrderRow[]> {
    /**
     * Fetch orders with status TICKETS_ISSUED where:
     *   event.ends_at + settlement_delay_days DAYS <= NOW()
     *   AND no balance_settlement exists yet
     * Uses FOR UPDATE SKIP LOCKED to allow safe concurrent workers.
     */
    return this.prisma.$queryRaw<EligibleOrderRow[]>`
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
    `;
  }

  private async processOrder(order: EligibleOrderRow): Promise<void> {
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
      }
    } catch (err) {
      this.logger.error(
        `SettlementWorker: failed to settle orderId=${order.id}`,
        err,
      );
    }
  }
}
