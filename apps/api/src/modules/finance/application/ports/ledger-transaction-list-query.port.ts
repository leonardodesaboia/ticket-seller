export const LEDGER_TRANSACTION_LIST_QUERY_PORT = Symbol('ILedgerTransactionListQueryPort');

export interface LedgerTransactionItem {
  id: string;
  sourceType: string;
  sourceId: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
  amount: string;
  entryType: string;
  currency: string;
}

export interface LedgerTransactionListParams {
  organizationId: string;
  cursor?: string;
  limit: number;
}

export interface ILedgerTransactionListQueryPort {
  query(params: LedgerTransactionListParams): Promise<{ data: LedgerTransactionItem[]; nextCursor: string | null }>;
}
