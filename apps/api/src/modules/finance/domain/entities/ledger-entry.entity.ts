export interface LedgerEntry {
  id: string;
  ledgerTransactionId: string;
  accountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: bigint;
  currency: string;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}
