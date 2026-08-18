import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FEE_POLICY_REPOSITORY,
  IFeePolicyRepository,
} from '../../domain/ports/fee-policy.repository.port';
import {
  IOrderPricingSnapshotRepository,
  ORDER_PRICING_SNAPSHOT_REPOSITORY,
} from '../../domain/ports/order-pricing-snapshot.repository.port';
import { OrderPricingSnapshot } from '../../domain/entities/order-pricing-snapshot.entity';
import { CalculateOrderPricingUseCase } from './calculate-order-pricing.use-case';

export interface RecordSaleInput {
  orderId: string;
  organizationId: string;
  grossAmount: bigint;
  currency: string;
  tx?: unknown;
}

@Injectable()
export class RecordSaleUseCase {
  private readonly logger = new Logger(RecordSaleUseCase.name);

  constructor(
    @Inject(FEE_POLICY_REPOSITORY)
    private readonly feePolicyRepository: IFeePolicyRepository,
    @Inject(ORDER_PRICING_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: IOrderPricingSnapshotRepository,
    private readonly calculateOrderPricing: CalculateOrderPricingUseCase,
  ) {}

  async execute(input: RecordSaleInput): Promise<void> {
    const { orderId, organizationId, grossAmount, currency, tx } = input;

    // Resolve active fee policy: org-specific first, then global fallback
    const policy =
      (await this.feePolicyRepository.findActive(organizationId)) ??
      (await this.feePolicyRepository.findActive());

    if (!policy) {
      throw new Error(
        `No active fee policy found for organizationId=${organizationId} and no global policy exists`,
      );
    }

    const { feeCalculation } = this.calculateOrderPricing.execute({
      grossAmount,
      currency,
      policy,
    });

    const snapshot: OrderPricingSnapshot = {
      orderId,
      feePolicyId: policy.id,
      grossAmount,
      currency,
      platformFeeBps: feeCalculation.platformFeeBps,
      platformFeeAmount: feeCalculation.platformFeeAmount,
      processingFeeBps: feeCalculation.processingFeeBps,
      processingFeeAmount: feeCalculation.processingFeeAmount,
      refundFeePolicy: policy.refundFeePolicy,
      sellerNetAmount: feeCalculation.sellerNetAmount,
      createdAt: new Date(),
    };

    await this.snapshotRepository.create(snapshot, tx);

    this.logger.log(
      `Pricing snapshot created for orderId=${orderId}: ` +
        `gross=${grossAmount} ${currency}, ` +
        `platformFee=${feeCalculation.platformFeeAmount} (${feeCalculation.platformFeeBps} bps), ` +
        `sellerNet=${feeCalculation.sellerNetAmount}`,
    );
  }
}
