import { assertPricingInvariant, calculateFeeAmount, calculateSellerNet } from './money';

describe('calculateFeeAmount', () => {
  it('returns 0n when bps is 0', () => {
    expect(calculateFeeAmount(10000n, 0)).toBe(0n);
  });

  it('calculates 5% fee (500 bps) on 10000 minor units', () => {
    expect(calculateFeeAmount(10000n, 500)).toBe(500n);
  });

  it('floors fractional results: bps=333, gross=10001 → 333 (floor of 333.033)', () => {
    // 10001 * 333 / 10000 = 333.0333 → floor → 333
    // Demonstrates floor behavior (without floor it would be 333.03, not 333.04 etc.)
    expect(calculateFeeAmount(10001n, 333)).toBe(333n);
  });

  it('floors fractional results: bps=333, gross=100001 → 3330 (floor of 3330.033)', () => {
    // 100001 * 333 / 10000 = 3330.0333 → floor → 3330
    expect(calculateFeeAmount(100001n, 333)).toBe(3330n);
  });

  it('handles 100% fee (10000 bps)', () => {
    expect(calculateFeeAmount(5000n, 10000)).toBe(5000n);
  });

  it('handles 1 bps on large amount', () => {
    // 1_000_000 * 1 / 10000 = 100
    expect(calculateFeeAmount(1_000_000n, 1)).toBe(100n);
  });

  it('preserves exact precision above Number.MAX_SAFE_INTEGER', () => {
    const grossAmount = 9_007_199_254_740_993n;

    expect(calculateFeeAmount(grossAmount, 10_000)).toBe(grossAmount);
  });

  it('returns 0n when gross is 0 and bps > 0', () => {
    expect(calculateFeeAmount(0n, 500)).toBe(0n);
  });
});

describe('calculateSellerNet', () => {
  it('returns gross minus both fees', () => {
    expect(calculateSellerNet(10000n, 500n, 100n)).toBe(9400n);
  });

  it('returns gross when both fees are zero', () => {
    expect(calculateSellerNet(10000n, 0n, 0n)).toBe(10000n);
  });
});

describe('assertPricingInvariant', () => {
  it('does not throw when invariant holds', () => {
    expect(() => assertPricingInvariant(10000n, 500n, 100n, 9400n)).not.toThrow();
  });

  it('does not throw when all fees are zero and sellerNet equals gross', () => {
    expect(() => assertPricingInvariant(5000n, 0n, 0n, 5000n)).not.toThrow();
  });

  it('throws when invariant is violated', () => {
    expect(() => assertPricingInvariant(10000n, 500n, 100n, 9500n)).toThrow(
      'Pricing invariant violated',
    );
  });

  it('throws with descriptive message showing the values', () => {
    expect(() => assertPricingInvariant(100n, 10n, 5n, 90n)).toThrow(
      '100 !== 10 + 5 + 90',
    );
  });
});
