export interface FinancialSummary {
  grossSales: string;
  platformFees: string;
  refunds: string;
  netSales: string;
  pendingAmount: string;
  availableAmount: string;
  reservedAmount: string;
  currency: string;
}

export interface LedgerTransactionItem {
  id: string;
  sourceType: string;
  sourceId: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
  amount: string;
  entryType: 'DEBIT' | 'CREDIT';
  currency: string;
}

export interface ListTransactionsResponse {
  data: LedgerTransactionItem[];
  nextCursor: string | null;
}

export type PayoutStatus =
  | 'SCHEDULED'
  | 'HELD'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

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

export interface ListPayoutsResponse {
  data: PayoutItem[];
  nextCursor: string | null;
}

export interface BalanceResponse {
  pendingAmount: string;
  availableAmount: string;
  reservedAmount: string;
  currency: string;
}

export interface CreatePayoutResponse {
  id: string;
  organizationId: string;
  recipientId: string;
  amount: string;
  currency: string;
  status: PayoutStatus;
  provider: string;
  idempotencyKey: string;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
}
