export type DisputeStatus = 'OPEN' | 'PROCESSED';

export interface PaymentDisputeEntity {
  id: string;
  organizationId: string;
  orderId: string;
  paymentAttemptId: string | null;
  provider: string;
  externalDisputeId: string;
  status: DisputeStatus;
  amount: bigint | null;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
}
