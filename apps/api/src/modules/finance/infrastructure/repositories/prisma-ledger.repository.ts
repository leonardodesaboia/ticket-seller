import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  ILedgerRepository,
  RecordLedgerTransactionInput,
} from '../../domain/ports/ledger.repository.port';
import { LedgerAccount } from '../../domain/entities/ledger-account.entity';
import { LedgerTransaction } from '../../domain/entities/ledger-transaction.entity';

type PrismaTransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

interface RawLedgerAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  organization_id: string | null;
  currency: string;
  created_at: Date;
}

interface RawLedgerTransaction {
  id: string;
  source_type: string;
  source_id: string;
  description: string | null;
  occurred_at: Date;
  created_at: Date;
}

function toAccountType(value: string): LedgerAccount['accountType'] {
  const valid = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
  if (valid.includes(value as LedgerAccount['accountType'])) {
    return value as LedgerAccount['accountType'];
  }
  throw new Error(`Invalid account_type: ${value}`);
}

function mapToLedgerAccount(raw: RawLedgerAccount): LedgerAccount {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    accountType: toAccountType(raw.account_type),
    organizationId: raw.organization_id,
    currency: raw.currency,
    createdAt: raw.created_at,
  };
}

function mapToLedgerTransaction(raw: RawLedgerTransaction): LedgerTransaction {
  return {
    id: raw.id,
    sourceType: raw.source_type,
    sourceId: raw.source_id,
    description: raw.description,
    occurredAt: raw.occurred_at,
    createdAt: raw.created_at,
  };
}

@Injectable()
export class PrismaLedgerRepository implements ILedgerRepository {
  private readonly logger = new Logger(PrismaLedgerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: unknown): PrismaTransactionClient | PrismaService {
    return (tx as PrismaTransactionClient | undefined) ?? this.prisma;
  }

  async findAccountByCode(code: string, tx?: unknown): Promise<LedgerAccount | null> {
    const client = this.client(tx);
    const rows = await client.$queryRaw<RawLedgerAccount[]>`
      SELECT id, code, name, account_type, organization_id, currency, created_at
      FROM ledger_accounts
      WHERE code = ${code}
        AND organization_id IS NULL
      LIMIT 1
    `;
    return rows[0] ? mapToLedgerAccount(rows[0]) : null;
  }

  async findOrCreateOrgAccount(
    code: string,
    name: string,
    accountType: LedgerAccount['accountType'],
    organizationId: string,
    currency: string,
    tx?: unknown,
  ): Promise<LedgerAccount> {
    const client = this.client(tx);

    // Atomic upsert: INSERT ON CONFLICT DO NOTHING, then SELECT
    await client.$executeRaw`
      INSERT INTO ledger_accounts (code, name, account_type, organization_id, currency)
      VALUES (${code}, ${name}, ${accountType}, ${organizationId}::uuid, ${currency})
      ON CONFLICT (code) DO NOTHING
    `;

    const rows = await client.$queryRaw<RawLedgerAccount[]>`
      SELECT id, code, name, account_type, organization_id, currency, created_at
      FROM ledger_accounts
      WHERE code = ${code}
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;

    if (!rows[0]) {
      throw new Error(
        `Failed to find or create ledger account: code=${code}, organizationId=${organizationId}`,
      );
    }

    return mapToLedgerAccount(rows[0]);
  }

  async findTransactionBySource(
    sourceType: string,
    sourceId: string,
    tx?: unknown,
  ): Promise<LedgerTransaction | null> {
    const client = this.client(tx);
    const rows = await client.$queryRaw<RawLedgerTransaction[]>`
      SELECT id, source_type, source_id, description, occurred_at, created_at
      FROM ledger_transactions
      WHERE source_type = ${sourceType}
        AND source_id = ${sourceId}
      LIMIT 1
    `;
    return rows[0] ? mapToLedgerTransaction(rows[0]) : null;
  }

  async recordTransaction(
    input: RecordLedgerTransactionInput,
    tx?: unknown,
  ): Promise<LedgerTransaction> {
    const { sourceType, sourceId, description, occurredAt, entries } = input;

    // 1. Verify balance invariant: sum(DEBIT) === sum(CREDIT)
    const debitTotal = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0n);
    const creditTotal = entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0n);

    if (debitTotal !== creditTotal) {
      throw new Error(
        `Ledger imbalance for ${sourceType}:${sourceId}: ` +
          `DEBIT=${debitTotal}, CREDIT=${creditTotal}`,
      );
    }

    const client = this.client(tx);
    const effectiveOccurredAt = occurredAt ?? new Date();

    // 2. Insert transaction with ON CONFLICT DO NOTHING for idempotency
    await client.$executeRaw`
      INSERT INTO ledger_transactions (source_type, source_id, description, occurred_at)
      VALUES (${sourceType}, ${sourceId}, ${description ?? null}, ${effectiveOccurredAt})
      ON CONFLICT (source_type, source_id) DO NOTHING
    `;

    // 3. Fetch the transaction (may be newly inserted or pre-existing)
    const rows = await client.$queryRaw<RawLedgerTransaction[]>`
      SELECT id, source_type, source_id, description, occurred_at, created_at
      FROM ledger_transactions
      WHERE source_type = ${sourceType}
        AND source_id = ${sourceId}
      LIMIT 1
    `;

    const transaction = rows[0];
    if (!transaction) {
      throw new Error(
        `Failed to find ledger_transaction for ${sourceType}:${sourceId} after INSERT`,
      );
    }

    // 4. Check whether entries already exist (idempotency: if transaction was pre-existing, skip entry insert)
    const existingEntries = await client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM ledger_entries
      WHERE ledger_transaction_id = ${transaction.id}::uuid
    `;
    const entryCount = Number(existingEntries[0]!.count);

    if (entryCount > 0) {
      this.logger.log(
        `Ledger transaction ${sourceType}:${sourceId} already has ${entryCount} entries — skipping insert (idempotent)`,
      );
      return mapToLedgerTransaction(transaction);
    }

    // 5. Insert all entries
    for (const entry of entries) {
      await client.$executeRaw`
        INSERT INTO ledger_entries
          (ledger_transaction_id, account_id, entry_type, amount, currency, description, occurred_at)
        VALUES
          (${transaction.id}::uuid, ${entry.accountId}::uuid, ${entry.entryType},
           ${entry.amount}, ${entry.currency}, ${entry.description ?? null},
           ${effectiveOccurredAt})
      `;
    }

    this.logger.log(
      `Ledger transaction recorded: ${sourceType}:${sourceId} ` +
        `DEBIT=${debitTotal}, CREDIT=${creditTotal}, entries=${entries.length}`,
    );

    return mapToLedgerTransaction(transaction);
  }
}
