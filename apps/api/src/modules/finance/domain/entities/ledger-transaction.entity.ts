export interface LedgerTransaction {
  id: string;
  sourceType: string;
  sourceId: string;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}
