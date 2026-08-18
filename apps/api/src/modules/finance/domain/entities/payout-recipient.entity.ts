export type PayoutRecipientStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface PayoutRecipient {
  id: string;
  organizationId: string;
  provider: string;
  externalRecipientId: string | null;
  status: PayoutRecipientStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
