export interface OrderPricingSnapshot {
  orderId: string;
  feePolicyId: string;
  grossAmount: bigint;
  currency: string;
  platformFeeBps: number;
  platformFeeAmount: bigint;
  processingFeeBps: number | null;
  processingFeeAmount: bigint;
  refundFeePolicy: 'RETAIN' | 'REFUND' | 'PROPORTIONAL' | 'TBD';
  sellerNetAmount: bigint;
  createdAt: Date;
}
