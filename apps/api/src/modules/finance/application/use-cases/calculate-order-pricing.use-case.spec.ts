import { CalculateOrderPricingUseCase } from './calculate-order-pricing.use-case';
import { FeePolicy } from '../../domain/entities/fee-policy.entity';

function makePolicy(overrides: Partial<FeePolicy> = {}): FeePolicy {
  return {
    id: 'policy-id',
    organizationId: null,
    platformFeeBps: 0,
    processingFeeBps: null,
    refundFeePolicy: 'TBD',
    settlementDelayDays: 7,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CalculateOrderPricingUseCase', () => {
  let useCase: CalculateOrderPricingUseCase;

  beforeEach(() => {
    useCase = new CalculateOrderPricingUseCase();
  });

  describe('with global policy (0 bps, no processing fee)', () => {
    it('returns zero fees and full gross as seller net', () => {
      const result = useCase.execute({
        grossAmount: 10000n,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 0, processingFeeBps: null }),
      });

      expect(result.feeCalculation.platformFeeAmount).toBe(0n);
      expect(result.feeCalculation.processingFeeAmount).toBe(0n);
      expect(result.feeCalculation.sellerNetAmount).toBe(10000n);
      expect(result.feeCalculation.platformFeeBps).toBe(0);
      expect(result.feeCalculation.processingFeeBps).toBeNull();
    });
  });

  describe('with platform fee only (500 bps = 5%)', () => {
    it('calculates 5% of 10000 = 500 and sellerNet = 9500', () => {
      const result = useCase.execute({
        grossAmount: 10000n,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 500, processingFeeBps: null }),
      });

      expect(result.feeCalculation.platformFeeAmount).toBe(500n);
      expect(result.feeCalculation.processingFeeAmount).toBe(0n);
      expect(result.feeCalculation.sellerNetAmount).toBe(9500n);
    });

    it('floors fractional result: 333 bps on 10001 = 333 (floor of 333.033)', () => {
      // 10001 * 333 / 10000 = 333.033 → floor → 333
      const result = useCase.execute({
        grossAmount: 10001n,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 333, processingFeeBps: null }),
      });

      expect(result.feeCalculation.platformFeeAmount).toBe(333n);
      expect(result.feeCalculation.sellerNetAmount).toBe(10001n - 333n);
    });
  });

  describe('with both platform fee and processing fee', () => {
    it('deducts both fees from seller net', () => {
      // gross=10000, platform=500 bps (500), processing=100 bps (100), sellerNet=9400
      const result = useCase.execute({
        grossAmount: 10000n,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 500, processingFeeBps: 100 }),
      });

      expect(result.feeCalculation.platformFeeAmount).toBe(500n);
      expect(result.feeCalculation.processingFeeAmount).toBe(100n);
      expect(result.feeCalculation.sellerNetAmount).toBe(9400n);
      expect(result.feeCalculation.processingFeeBps).toBe(100);
    });

    it('satisfies invariant: gross === platformFee + processingFee + sellerNet', () => {
      const grossAmount = 99999n;
      const result = useCase.execute({
        grossAmount,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 250, processingFeeBps: 150 }),
      });

      const { platformFeeAmount, processingFeeAmount, sellerNetAmount } = result.feeCalculation;
      expect(platformFeeAmount + processingFeeAmount + sellerNetAmount).toBe(grossAmount);
    });
  });

  describe('with 100% platform fee (10000 bps)', () => {
    it('seller net is zero', () => {
      const result = useCase.execute({
        grossAmount: 5000n,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 10000, processingFeeBps: null }),
      });

      expect(result.feeCalculation.platformFeeAmount).toBe(5000n);
      expect(result.feeCalculation.sellerNetAmount).toBe(0n);
    });
  });

  describe('edge cases', () => {
    it('handles single minor unit (1 centavo)', () => {
      const result = useCase.execute({
        grossAmount: 1n,
        currency: 'BRL',
        policy: makePolicy({ platformFeeBps: 500, processingFeeBps: null }),
      });

      // 1 * 500 / 10000 = 0.05 → floor → 0
      expect(result.feeCalculation.platformFeeAmount).toBe(0n);
      expect(result.feeCalculation.sellerNetAmount).toBe(1n);
    });

    it('returns consistent platformFeeBps and processingFeeBps from policy', () => {
      const policy = makePolicy({ platformFeeBps: 200, processingFeeBps: 50 });
      const result = useCase.execute({ grossAmount: 10000n, currency: 'BRL', policy });

      expect(result.feeCalculation.platformFeeBps).toBe(200);
      expect(result.feeCalculation.processingFeeBps).toBe(50);
    });
  });
});
