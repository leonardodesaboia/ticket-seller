import { OrderPricingSnapshot } from '../entities/order-pricing-snapshot.entity';

export const ORDER_PRICING_SNAPSHOT_REPOSITORY = Symbol('ORDER_PRICING_SNAPSHOT_REPOSITORY');

export interface IOrderPricingSnapshotRepository {
  findByOrderId(orderId: string): Promise<OrderPricingSnapshot | null>;
  /**
   * Persist a new snapshot atomically.
   * Uses ON CONFLICT (order_id) DO NOTHING for idempotency.
   *
   * @param snapshot - The snapshot to persist
   * @param tx - Optional Prisma transaction client. When provided, uses it; otherwise creates its own.
   */
  create(snapshot: OrderPricingSnapshot, tx?: unknown): Promise<void>;
}
