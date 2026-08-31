import { FeePolicy } from '../../domain/entities/fee-policy.entity';
import { FeeCalculation } from '../../domain/value-objects/fee-calculation.vo';
import {
  assertPricingInvariant,
  calculateFeeAmount,
  calculateSellerNet,
} from '../../../../shared/kernel/money';

export interface CalculateOrderPricingInput {
  grossAmount: bigint;
  currency: string;
  policy: FeePolicy;
}

export interface CalculateOrderPricingOutput {
  feeCalculation: FeeCalculation;
}

/**
 * Pure use case: no IO, no side effects.
 * Calculates fee decomposition for an order given a fee policy.
 *
 * All values are in minor units (bigint).
 * Uses Math.floor rounding via calculateFeeAmount.
 */
export class CalculateOrderPricingUseCase {
  execute(input: CalculateOrderPricingInput): CalculateOrderPricingOutput {
    const { grossAmount, policy } = input;

    const platformFeeAmount = calculateFeeAmount(grossAmount, policy.platformFeeBps);

    const processingFeeBps = policy.processingFeeBps ?? null;
    const processingFeeAmount =
      processingFeeBps !== null ? calculateFeeAmount(grossAmount, processingFeeBps) : 0n;

    const sellerNetAmount = calculateSellerNet(grossAmount, platformFeeAmount, processingFeeAmount);

    assertPricingInvariant(grossAmount, platformFeeAmount, processingFeeAmount, sellerNetAmount);

    const buyerFeeBps = policy.buyerFeeBps;
    const buyerFeeAmount = calculateFeeAmount(grossAmount, buyerFeeBps);

    const feeCalculation: FeeCalculation = {
      platformFeeBps: policy.platformFeeBps,
      platformFeeAmount,
      processingFeeBps,
      processingFeeAmount,
      buyerFeeBps,
      buyerFeeAmount,
      sellerNetAmount,
    };

    return { feeCalculation };
  }
}
