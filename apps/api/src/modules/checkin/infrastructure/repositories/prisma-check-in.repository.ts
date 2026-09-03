import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CheckIn, CheckInResult, CheckInSource } from '../../domain/check-in.entity';
import {
  AttendanceByTicketTypeRow,
  CreateCheckInData,
  EventAttendanceData,
  ICheckInRepository,
  RecentCheckInRow,
} from '../../domain/ports/check-in-repository.port';

interface RawMetricsRow {
  ticket_type_id: string;
  ticket_type_name: string;
  total_issued: bigint;
  total_admitted: bigint;
}

interface RawRecentRow {
  checked_in_at: Date;
  ticket_type_name: string;
  performed_by_user_id: string | null;
}

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

  async findByIdempotencyKey(key: string, organizationId: string): Promise<CheckIn | null> {
    const rows = await this.prisma.$queryRaw<RawCheckInRow[]>`
      SELECT id, organization_id, event_id, ticket_id, credential_id,
             performed_by_user_id, result, idempotency_key, checked_in_at, source, notes
      FROM check_ins
      WHERE idempotency_key = ${key}
        AND organization_id = ${organizationId}::uuid
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
      RETURNING id, organization_id, event_id, ticket_id, credential_id,
                performed_by_user_id, result, idempotency_key, checked_in_at, source, notes
    `;

    if (!rows[0]) throw new Error('createCheckIn: no row returned');
    return toEntity(rows[0]);
  }

  async getEventAttendance(organizationId: string, eventId: string): Promise<EventAttendanceData | null> {
    // Cross-tenant guard: verify event belongs to organization
    const eventRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM events
      WHERE id = ${eventId}::uuid
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    if (!eventRows[0]) return null;

    // Metrics per ticket type — no N+1
    const metricsRows = await this.prisma.$queryRaw<RawMetricsRow[]>`
      SELECT
        tt.id AS ticket_type_id,
        tt.name AS ticket_type_name,
        COUNT(DISTINCT t.id) AS total_issued,
        COUNT(DISTINCT ci.ticket_id) AS total_admitted
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      LEFT JOIN check_ins ci ON ci.ticket_id = t.id AND ci.result = 'ADMITTED'
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.event_id = ${eventId}::uuid
      GROUP BY tt.id, tt.name
    `;

    const byTicketType: AttendanceByTicketTypeRow[] = metricsRows.map((row) => ({
      ticketTypeId: row.ticket_type_id,
      ticketTypeName: row.ticket_type_name,
      totalIssued: Number(row.total_issued),
      totalAdmitted: Number(row.total_admitted),
    }));

    // Last 20 ADMITTED check-ins
    const recentRows = await this.prisma.$queryRaw<RawRecentRow[]>`
      SELECT
        ci.checked_in_at,
        tt.name AS ticket_type_name,
        ci.performed_by_user_id
      FROM check_ins ci
      JOIN tickets t ON t.id = ci.ticket_id
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE ci.organization_id = ${organizationId}::uuid
        AND ci.event_id = ${eventId}::uuid
        AND ci.result = 'ADMITTED'
      ORDER BY ci.checked_in_at DESC
      LIMIT 20
    `;

    const recentCheckIns: RecentCheckInRow[] = recentRows.map((row) => ({
      checkedInAt: row.checked_in_at,
      ticketTypeName: row.ticket_type_name,
      performedByUserId: row.performed_by_user_id,
    }));

    return { byTicketType, recentCheckIns };
  }
}
