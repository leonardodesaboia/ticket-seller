/**
 * Value object representing the result of a fee calculation.
 * All amounts are in minor units (bigint).
 */
export interface FeeCalculation {
  platformFeeBps: number;
  platformFeeAmount: bigint;
  processingFeeBps: number | null;
  processingFeeAmount: bigint;
  sellerNetAmount: bigint;
}
