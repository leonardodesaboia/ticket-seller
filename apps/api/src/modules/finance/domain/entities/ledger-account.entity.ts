export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  organizationId: string | null;
  currency: string;
  createdAt: Date;
}
