import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IFeePolicyRepository } from '../../domain/ports/fee-policy.repository.port';
import { FeePolicy } from '../../domain/entities/fee-policy.entity';

type RefundFeePolicyValue = 'RETAIN' | 'REFUND' | 'PROPORTIONAL' | 'TBD';

function toRefundFeePolicy(value: string): RefundFeePolicyValue {
  const valid: RefundFeePolicyValue[] = ['RETAIN', 'REFUND', 'PROPORTIONAL', 'TBD'];
  if (valid.includes(value as RefundFeePolicyValue)) {
    return value as RefundFeePolicyValue;
  }
  throw new Error(`Invalid refund_fee_policy value: ${value}`);
}

@Injectable()
export class PrismaFeePolicyRepository implements IFeePolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(organizationId?: string): Promise<FeePolicy | null> {
    if (organizationId !== undefined) {
      // Try org-specific active policy first
      const orgPolicy = await this.prisma.feePolicy.findFirst({
        where: {
          organizationId,
          isActive: true,
        },
      });
      if (orgPolicy) {
        return this.mapToEntity(orgPolicy);
      }
    }

    // Fall back to global policy (organizationId IS NULL)
    const globalPolicy = await this.prisma.feePolicy.findFirst({
      where: {
        organizationId: null,
        isActive: true,
      },
    });

    return globalPolicy ? this.mapToEntity(globalPolicy) : null;
  }

  private mapToEntity(record: {
    id: string;
    organizationId: string | null;
    platformFeeBps: number;
    processingFeeBps: number | null;
    refundFeePolicy: string;
    settlementDelayDays: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): FeePolicy {
    return {
      id: record.id,
      organizationId: record.organizationId,
      platformFeeBps: record.platformFeeBps,
      processingFeeBps: record.processingFeeBps,
      refundFeePolicy: toRefundFeePolicy(record.refundFeePolicy),
      settlementDelayDays: record.settlementDelayDays,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
