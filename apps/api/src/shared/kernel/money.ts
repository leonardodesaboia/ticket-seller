/**
 * Pure financial calculation utilities.
 * All monetary values are in minor units (bigint).
 * Never use float or double for money calculations.
 */

/**
 * Calculate a fee amount in minor units using basis points (bps).
 * Integer division ensures deterministic rounding — always rounds down.
 *
 * @param grossAmount - Gross amount in minor units (e.g. centavos)
 * @param feeBps - Fee in basis points (1 bps = 0.01%). Max 10000 = 100%.
 * @returns Fee amount in minor units, floored
 */
export function calculateFeeAmount(grossAmount: bigint, feeBps: number): bigint {
  if (feeBps === 0) return 0n;
  return (grossAmount * BigInt(feeBps)) / 10_000n;
}

/**
 * Calculate seller net amount after deducting platform and processing fees.
 *
 * @param grossAmount - Gross amount in minor units
 * @param platformFeeAmount - Platform fee in minor units
 * @param processingFeeAmount - Processing fee in minor units
 * @returns Seller net amount in minor units
 */
export function calculateSellerNet(
  grossAmount: bigint,
  platformFeeAmount: bigint,
  processingFeeAmount: bigint,
): bigint {
  return grossAmount - platformFeeAmount - processingFeeAmount;
}

/**
 * Assert the pricing invariant:
 * gross === platformFee + processingFee + sellerNet
 *
 * Throws if the invariant is violated.
 *
 * @param gross - Gross amount in minor units
 * @param platformFee - Platform fee in minor units
 * @param processingFee - Processing fee in minor units
 * @param sellerNet - Seller net amount in minor units
 */
export function assertPricingInvariant(
  gross: bigint,
  platformFee: bigint,
  processingFee: bigint,
  sellerNet: bigint,
): void {
  if (gross !== platformFee + processingFee + sellerNet) {
    throw new Error(
      `Pricing invariant violated: ${gross} !== ${platformFee} + ${processingFee} + ${sellerNet}`,
    );
  }
}
