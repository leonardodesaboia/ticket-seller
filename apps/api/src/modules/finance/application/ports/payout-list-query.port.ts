import { PayoutStatus } from '../../domain/entities/payout.entity';

export const PAYOUT_LIST_QUERY_PORT = Symbol('IPayoutListQueryPort');

export interface PayoutItem {
  id: string;
  organizationId: string;
  recipientId: string;
  amount: string;
  currency: string;
  status: PayoutStatus;
  provider: string;
  externalPayoutId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  requestedAt: string;
  succeededAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutListParams {
  organizationId: string;
  cursor?: string;
  limit: number;
}

export interface IPayoutListQueryPort {
  query(params: PayoutListParams): Promise<{ data: PayoutItem[]; nextCursor: string | null }>;
}
