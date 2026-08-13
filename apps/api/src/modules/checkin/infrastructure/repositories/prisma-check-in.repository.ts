import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CheckIn, CheckInResult, CheckInSource } from '../../domain/check-in.entity';
import {
  CreateCheckInData,
  ICheckInRepository,
} from '../../domain/ports/check-in-repository.port';

interface RawCheckInRow {
  id: string;
  organization_id: string;
  event_id: string;
  ticket_id: string;
  credential_id: string;
  performed_by_user_id: string | null;
  result: string;
  idempotency_key: string | null;
  checked_in_at: Date;
  source: string;
  notes: string | null;
}

function toEntity(row: RawCheckInRow): CheckIn {
  return new CheckIn({
    id: row.id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    ticketId: row.ticket_id,
    credentialId: row.credential_id,
    performedByUserId: row.performed_by_user_id,
    result: row.result as CheckInResult,
    idempotencyKey: row.idempotency_key,
    checkedInAt: row.checked_in_at,
    source: row.source as CheckInSource,
    notes: row.notes,
  });
}

@Injectable()
export class PrismaCheckInRepository implements ICheckInRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(key: string): Promise<CheckIn | null> {
    const rows = await this.prisma.$queryRaw<RawCheckInRow[]>`
      SELECT * FROM check_ins
      WHERE idempotency_key = ${key}
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async existsAdmittedForTicket(ticketId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM check_ins
      WHERE ticket_id = ${ticketId}::uuid
        AND result = 'ADMITTED'
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async createCheckIn(data: CreateCheckInData): Promise<CheckIn> {
    // ON CONFLICT on idempotency_key → returns existing row (replay safe).
    // ON CONFLICT on partial unique index (ticket_id WHERE result='ADMITTED') → throws 23505.
    // Null values require special handling in $queryRaw template literals.
    const performedByUserIdExpr = data.performedByUserId
      ? Prisma.sql`${data.performedByUserId}::uuid`
      : Prisma.sql`NULL::uuid`;

    const idempotencyKeyExpr = data.idempotencyKey !== null
      ? Prisma.sql`${data.idempotencyKey}`
      : Prisma.sql`NULL`;

    const notesExpr = data.notes !== null
      ? Prisma.sql`${data.notes}`
      : Prisma.sql`NULL`;

    const rows = await this.prisma.$queryRaw<RawCheckInRow[]>`
      INSERT INTO check_ins (
        id, organization_id, event_id, ticket_id, credential_id,
        performed_by_user_id, result, idempotency_key, source, notes
      ) VALUES (
        ${data.id}::uuid,
        ${data.organizationId}::uuid,
        ${data.eventId}::uuid,
        ${data.ticketId}::uuid,
        ${data.credentialId}::uuid,
        ${performedByUserIdExpr},
        ${data.result},
        ${idempotencyKeyExpr},
        ${data.source},
        ${notesExpr}
      )
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
        DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING *
    `;

    if (!rows[0]) throw new Error('createCheckIn: no row returned');
    return toEntity(rows[0]);
  }
}
