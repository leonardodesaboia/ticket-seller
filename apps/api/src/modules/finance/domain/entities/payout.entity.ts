export type PayoutStatus =
  | 'SCHEDULED'
  | 'HELD'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

export interface Payout {
  id: string;
  organizationId: string;
  recipientId: string;
  amount: bigint;
  currency: string;
  status: PayoutStatus;
  provider: string;
  externalPayoutId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  requestedAt: Date;
  succeededAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
