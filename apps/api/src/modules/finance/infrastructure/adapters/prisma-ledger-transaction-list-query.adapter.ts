import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  ILedgerTransactionListQueryPort,
  LedgerTransactionListParams,
  LedgerTransactionItem,
} from '../../application/ports/ledger-transaction-list-query.port';

interface RawLedgerRow {
  id: string;
  source_type: string;
  source_id: string;
  description: string | null;
  occurred_at: Date;
  created_at: Date;
  amount: bigint;
  entry_type: string;
  currency: string;
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const pipeIdx = decoded.indexOf('|');
  if (pipeIdx === -1) throw new Error('Invalid cursor format');
  const occurredAt = new Date(decoded.slice(0, pipeIdx));
  const id = decoded.slice(pipeIdx + 1);
  return { occurredAt, id };
}

@Injectable()
export class PrismaLedgerTransactionListQueryAdapter
  implements ILedgerTransactionListQueryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async query(
    params: LedgerTransactionListParams,
  ): Promise<{ data: LedgerTransactionItem[]; nextCursor: string | null }> {
    const { organizationId, cursor, limit } = params;
    const pageSize = Math.min(limit, 100);
    const client = this.prisma as unknown as PrismaClient;

    let rows: RawLedgerRow[];

    if (cursor) {
      const { occurredAt, id } = decodeCursor(cursor);
      rows = await client.$queryRaw<RawLedgerRow[]>`
        SELECT
          lt.id,
          lt.source_type,
          lt.source_id,
          lt.description,
          lt.occurred_at,
          lt.created_at,
          le.amount,
          le.entry_type,
          le.currency
        FROM ledger_transactions lt
        JOIN ledger_entries le ON le.ledger_transaction_id = lt.id
        JOIN ledger_accounts la ON la.id = le.account_id
        WHERE la.organization_id = ${organizationId}::uuid
          AND (lt.occurred_at, lt.id) < (${occurredAt}::timestamptz, ${id}::uuid)
        ORDER BY lt.occurred_at DESC, lt.id DESC
        LIMIT ${pageSize}
      `;
    } else {
      rows = await client.$queryRaw<RawLedgerRow[]>`
        SELECT
          lt.id,
          lt.source_type,
          lt.source_id,
          lt.description,
          lt.occurred_at,
          lt.created_at,
          le.amount,
          le.entry_type,
          le.currency
        FROM ledger_transactions lt
        JOIN ledger_entries le ON le.ledger_transaction_id = lt.id
        JOIN ledger_accounts la ON la.id = le.account_id
        WHERE la.organization_id = ${organizationId}::uuid
        ORDER BY lt.occurred_at DESC, lt.id DESC
        LIMIT ${pageSize}
      `;
    }

    const data: LedgerTransactionItem[] = rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      description: row.description,
      occurredAt: row.occurred_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      amount: row.amount.toString(),
      entryType: row.entry_type,
      currency: row.currency,
    }));

    let nextCursor: string | null = null;
    if (rows.length === pageSize) {
      const last = rows[rows.length - 1]!;
      nextCursor = encodeCursor(last.occurred_at, last.id);
    }

    return { data, nextCursor };
  }
}
