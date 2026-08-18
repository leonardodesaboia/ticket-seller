import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PayoutStatus } from '../../domain/entities/payout.entity';

export interface ListPayoutsInput {
  organizationId: string;
  cursor?: string;
  limit?: number;
}

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

export interface ListPayoutsResult {
  data: PayoutItem[];
  nextCursor: string | null;
}

interface RawPayoutRow {
  id: string;
  organization_id: string;
  recipient_id: string;
  amount: bigint;
  currency: string;
  status: string;
  provider: string;
  external_payout_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  requested_at: Date;
  succeeded_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function encodeCursor(requestedAt: Date, id: string): string {
  return Buffer.from(`${requestedAt.toISOString()}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { requestedAt: Date; id: string } {
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const pipeIdx = decoded.indexOf('|');
  if (pipeIdx === -1) throw new Error('Invalid cursor format');
  const requestedAt = new Date(decoded.slice(0, pipeIdx));
  const id = decoded.slice(pipeIdx + 1);
  return { requestedAt, id };
}

function mapToItem(row: RawPayoutRow): PayoutItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    recipientId: row.recipient_id,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status as PayoutStatus,
    provider: row.provider,
    externalPayoutId: row.external_payout_id,
    idempotencyKey: row.idempotency_key,
    failureReason: row.failure_reason,
    requestedAt: row.requested_at.toISOString(),
    succeededAt: row.succeeded_at?.toISOString() ?? null,
    failedAt: row.failed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class ListPayoutsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListPayoutsInput): Promise<ListPayoutsResult> {
    const { organizationId, cursor, limit = 20 } = input;
    const pageSize = Math.min(limit, 100);
    const client = this.prisma as unknown as PrismaClient;

    let rows: RawPayoutRow[];

    if (cursor) {
      const { requestedAt, id } = decodeCursor(cursor);
      rows = await client.$queryRaw<RawPayoutRow[]>`
        SELECT id, organization_id, recipient_id, amount, currency, status, provider,
               external_payout_id, idempotency_key, failure_reason,
               requested_at, succeeded_at, failed_at, created_at, updated_at
        FROM payouts
        WHERE organization_id = ${organizationId}::uuid
          AND (requested_at, id) < (${requestedAt}::timestamptz, ${id}::uuid)
        ORDER BY requested_at DESC, id DESC
        LIMIT ${pageSize}
      `;
    } else {
      rows = await client.$queryRaw<RawPayoutRow[]>`
        SELECT id, organization_id, recipient_id, amount, currency, status, provider,
               external_payout_id, idempotency_key, failure_reason,
               requested_at, succeeded_at, failed_at, created_at, updated_at
        FROM payouts
        WHERE organization_id = ${organizationId}::uuid
        ORDER BY requested_at DESC, id DESC
        LIMIT ${pageSize}
      `;
    }

    const data = rows.map(mapToItem);

    let nextCursor: string | null = null;
    if (rows.length === pageSize) {
      const last = rows[rows.length - 1]!;
      nextCursor = encodeCursor(last.requested_at, last.id);
    }

    return { data, nextCursor };
  }
}
