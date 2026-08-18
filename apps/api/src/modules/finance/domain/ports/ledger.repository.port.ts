import { LedgerAccount } from '../entities/ledger-account.entity';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';

export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');

export interface CreateLedgerEntryInput {
  accountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: bigint;
  currency: string;
  description?: string;
}

export interface RecordLedgerTransactionInput {
  sourceType: string;
  sourceId: string;
  description?: string;
  occurredAt?: Date;
  entries: CreateLedgerEntryInput[];
}

export interface ILedgerRepository {
  /**
   * Finds existing org-scoped ledger account by code+orgId, or creates it atomically
   * using INSERT ON CONFLICT DO NOTHING.
   */
  findOrCreateOrgAccount(
    code: string,
    name: string,
    accountType: LedgerAccount['accountType'],
    organizationId: string,
    currency: string,
    tx?: unknown,
  ): Promise<LedgerAccount>;

  /**
   * Finds a platform-scoped ledger account by its code (organizationId IS NULL).
   */
  findAccountByCode(code: string, tx?: unknown): Promise<LedgerAccount | null>;

  /**
   * Records a double-entry transaction with all its entries atomically.
   * Verifies sum(DEBIT) === sum(CREDIT) before INSERT.
   * Idempotent: if (sourceType, sourceId) already exists, returns existing transaction
   * without inserting new entries.
   */
  recordTransaction(
    input: RecordLedgerTransactionInput,
    tx?: unknown,
  ): Promise<LedgerTransaction>;

  /**
   * Checks whether a transaction for the given source already exists (idempotency check).
   */
  findTransactionBySource(
    sourceType: string,
    sourceId: string,
    tx?: unknown,
  ): Promise<LedgerTransaction | null>;
}
