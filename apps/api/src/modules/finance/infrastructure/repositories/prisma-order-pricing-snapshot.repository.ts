import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IOrderPricingSnapshotRepository } from '../../domain/ports/order-pricing-snapshot.repository.port';
import { OrderPricingSnapshot } from '../../domain/entities/order-pricing-snapshot.entity';

type PrismaTransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

type RefundFeePolicyValue = 'RETAIN' | 'REFUND' | 'PROPORTIONAL' | 'TBD';

function toRefundFeePolicy(value: string): RefundFeePolicyValue {
  const valid: RefundFeePolicyValue[] = ['RETAIN', 'REFUND', 'PROPORTIONAL', 'TBD'];
  if (valid.includes(value as RefundFeePolicyValue)) {
    return value as RefundFeePolicyValue;
  }
  throw new Error(`Invalid refund_fee_policy value: ${value}`);
}

@Injectable()
export class PrismaOrderPricingSnapshotRepository implements IOrderPricingSnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrderId(orderId: string): Promise<OrderPricingSnapshot | null> {
    const record = await this.prisma.orderPricingSnapshot.findUnique({
      where: { orderId },
    });

    return record ? this.mapToEntity(record) : null;
  }

  async create(snapshot: OrderPricingSnapshot, tx?: unknown): Promise<void> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    await client.$executeRaw`
      INSERT INTO order_pricing_snapshots
        (order_id, fee_policy_id, gross_amount, currency,
         platform_fee_bps, platform_fee_amount,
         processing_fee_bps, processing_fee_amount,
         buyer_fee_bps, buyer_fee_amount,
         refund_fee_policy, seller_net_amount, created_at)
      VALUES
        (${snapshot.orderId}::uuid, ${snapshot.feePolicyId}::uuid,
         ${snapshot.grossAmount}, ${snapshot.currency},
         ${snapshot.platformFeeBps}, ${snapshot.platformFeeAmount},
         ${snapshot.processingFeeBps ?? null}, ${snapshot.processingFeeAmount},
         ${snapshot.buyerFeeBps}, ${snapshot.buyerFeeAmount},
         ${snapshot.refundFeePolicy}, ${snapshot.sellerNetAmount},
         ${snapshot.createdAt})
      ON CONFLICT (order_id) DO NOTHING
    `;
  }

  private mapToEntity(record: {
    orderId: string;
    feePolicyId: string;
    grossAmount: bigint;
    currency: string;
    platformFeeBps: number;
    platformFeeAmount: bigint;
    processingFeeBps: number | null;
    processingFeeAmount: bigint;
    buyerFeeBps: number;
    buyerFeeAmount: bigint;
    refundFeePolicy: string;
    sellerNetAmount: bigint;
    createdAt: Date;
  }): OrderPricingSnapshot {
    return {
      orderId: record.orderId,
      feePolicyId: record.feePolicyId,
      grossAmount: record.grossAmount,
      currency: record.currency,
      platformFeeBps: record.platformFeeBps,
      platformFeeAmount: record.platformFeeAmount,
      processingFeeBps: record.processingFeeBps,
      processingFeeAmount: record.processingFeeAmount,
      buyerFeeBps: record.buyerFeeBps,
      buyerFeeAmount: record.buyerFeeAmount,
      refundFeePolicy: toRefundFeePolicy(record.refundFeePolicy),
      sellerNetAmount: record.sellerNetAmount,
      createdAt: record.createdAt,
    };
  }
}
