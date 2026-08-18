export interface FeePolicy {
  id: string;
  organizationId: string | null;
  platformFeeBps: number;
  processingFeeBps: number | null;
  refundFeePolicy: 'RETAIN' | 'REFUND' | 'PROPORTIONAL' | 'TBD';
  settlementDelayDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
