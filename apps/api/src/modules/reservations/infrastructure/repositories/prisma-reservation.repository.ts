import * as crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  EventNotFoundForReservationError,
  EventNotPublishedForReservationError,
  InsufficientInventoryForReservationError,
  InvalidReservationTokenError,
  ReservationAlreadyConsumedError,
  ReservationExpiredError,
  ReservationIdempotencyConflictError,
  ReservationNotFoundError,
  TicketTypeInactiveForReservationError,
  TicketTypeNotFoundForReservationError,
} from '../../domain/reservation.errors';
import type {
  CreateReservationOperationInput,
  CreateReservationOperationResult,
  IReservationRepository,
  ReservationView,
  ReservationViewItem,
} from '../../domain/ports/reservation-repository.port';

type TransactionClient = Prisma.TransactionClient;

interface ReservationRow {
  id: string;
  status: string;
  expires_at: Date;
  currency: string;
  subtotal_amount: bigint;
  continuation_token_hash: string;
  organization_id: string;
  event_id: string;
}

interface ReservationItemRow {
  ticket_type_id: string;
  name_snapshot: string;
  quantity: number;
  unit_price_amount: bigint;
  subtotal_amount: bigint;
}

function amount(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Reservation amount exceeds JavaScript safe integer range');
  return result;
}

function toView(row: ReservationRow, items: ReservationItemRow[]): ReservationView {
  return {
    reservationId: row.id,
    status: row.status as ReservationView['status'],
    expiresAt: row.expires_at.toISOString(),
    currency: row.currency,
    subtotalAmount: amount(row.subtotal_amount),
    items: items.map((item): ReservationViewItem => ({
      ticketTypeId: item.ticket_type_id,
      name: item.name_snapshot,
      quantity: item.quantity,
      unitPriceAmount: amount(item.unit_price_amount),
      subtotalAmount: amount(item.subtotal_amount),
    })),
  };
}

function isIdempotencyUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  return String(error.meta?.['target'] ?? '').toLowerCase().includes('idempotency');
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function isSerializationFailure(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const msg = String(error.message);
  // P2034: Prisma serialization failure; 40001: serialization_failure; 40P01: deadlock_detected
  return error.code === 'P2034' || msg.includes('40001') || msg.includes('40P01');
}

@Injectable()
export class PrismaReservationRepository implements IReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReservationOperationInput): Promise<CreateReservationOperationResult> {
    return this.createWithRetries(input, 0);
  }

  private async createWithRetries(
    input: CreateReservationOperationInput,
    attempt: number,
  ): Promise<CreateReservationOperationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyRecord.create({
          data: {
            idempotencyKey: `reservation-create:${input.idempotencyKey}`,
            requestHash: input.requestHash,
            expiresAt: input.expiresAt,
          },
        });
        const event = await tx.event.findFirst({
          where: { slug: input.eventSlug },
          select: {
            id: true, organizationId: true, status: true, currency: true,
            ticketTypes: { select: { id: true, name: true, status: true, priceAmount: true } },
          },
        });
        if (!event) throw new EventNotFoundForReservationError();
        if (event.status !== 'PUBLISHED' || !event.currency) throw new EventNotPublishedForReservationError();

        const requested = new Map<string, number>();
        for (const item of input.items) requested.set(item.ticketTypeId, (requested.get(item.ticketTypeId) ?? 0) + item.quantity);
        const ticketTypes = new Map(event.ticketTypes.map((ticketType) => [ticketType.id, ticketType]));
        // Sort by ticketTypeId (code-point order) to match Postgres ORDER BY ticket_type_id,
        // preventing ABBA deadlocks when concurrent transactions lock the same rows.
        const snapshots = [...requested]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([ticketTypeId, quantity]) => {
            const ticketType = ticketTypes.get(ticketTypeId);
            if (!ticketType) throw new TicketTypeNotFoundForReservationError();
            if (ticketType.status !== 'ACTIVE') throw new TicketTypeInactiveForReservationError();
            return { ticketTypeId, quantity, name: ticketType.name, unitPriceAmount: ticketType.priceAmount };
          });

        await this.expireHoldsForTicketTypes(tx, snapshots.map((item) => item.ticketTypeId));
        for (const snapshot of snapshots) {
          const updated = await tx.$executeRaw`
            UPDATE ticket_inventory SET reserved = reserved + ${snapshot.quantity}, version = version + 1, updated_at = NOW()
            WHERE ticket_type_id = ${snapshot.ticketTypeId}::uuid
              AND organization_id = ${event.organizationId}::uuid
              AND (capacity - reserved - committed) >= ${snapshot.quantity}
          `;
          if (updated === 0) throw new InsufficientInventoryForReservationError();
        }

        const subtotalAmount = snapshots.reduce((sum, item) => sum + BigInt(item.quantity) * BigInt(item.unitPriceAmount), 0n);
        const rows = await tx.$queryRaw<ReservationRow[]>`
          INSERT INTO reservations
            (organization_id, event_id, status, continuation_token_hash, idempotency_key, expires_at, currency, subtotal_amount)
          VALUES
            (${event.organizationId}::uuid, ${event.id}::uuid, 'ACTIVE', ${input.tokenHash}, ${input.idempotencyKey}, ${input.expiresAt}, ${event.currency}, ${subtotalAmount})
          RETURNING id, status, expires_at, currency, subtotal_amount, continuation_token_hash, organization_id, event_id
        `;
        const reservation = rows[0];
        if (!reservation) throw new Error('Reservation insert did not return a row');
        const itemRows: ReservationItemRow[] = [];
        for (const snapshot of snapshots) {
          const itemSubtotal = BigInt(snapshot.quantity) * BigInt(snapshot.unitPriceAmount);
          await tx.$executeRaw`
            INSERT INTO reservation_items
              (reservation_id, ticket_type_id, quantity, name_snapshot, unit_price_amount, currency, subtotal_amount)
            VALUES
              (${reservation.id}::uuid, ${snapshot.ticketTypeId}::uuid, ${snapshot.quantity}, ${snapshot.name}, ${BigInt(snapshot.unitPriceAmount)}, ${event.currency}, ${itemSubtotal})
          `;
          itemRows.push({ ticket_type_id: snapshot.ticketTypeId, name_snapshot: snapshot.name, quantity: snapshot.quantity, unit_price_amount: BigInt(snapshot.unitPriceAmount), subtotal_amount: itemSubtotal });
        }
        const view = toView(reservation, itemRows);
        await tx.outboxEvent.create({ data: { aggregateType: 'reservation', aggregateId: reservation.id, type: 'reservation.created.v1', version: '1', organizationId: event.organizationId, payload: { reservationId: reservation.id, eventId: event.id, organizationId: event.organizationId } } });
        await tx.idempotencyRecord.update({ where: { idempotencyKey: `reservation-create:${input.idempotencyKey}` }, data: { responseStatus: 201, responseBody: JSON.parse(JSON.stringify(view)) as Prisma.InputJsonValue, completedAt: new Date() } });
        return { reservation: view, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isSerializationFailure(error) && attempt < 2) {
        const delayMs = Math.min((50 + Math.random() * 50) * 2 ** attempt, 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.createWithRetries(input, attempt + 1);
      }
      if (!isIdempotencyUniqueViolation(error)) throw error;
      const existing = await this.prisma.idempotencyRecord.findUnique({ where: { idempotencyKey: `reservation-create:${input.idempotencyKey}` } });
      if (!existing || existing.requestHash !== input.requestHash || !existing.completedAt) throw new ReservationIdempotencyConflictError();
      const reservation = await this.findReservation(this.prisma, 'idempotency_key', input.idempotencyKey);
      if (!reservation) throw new ReservationIdempotencyConflictError();
      return { reservation: toView(reservation, await this.findItems(this.prisma, reservation.id)), replayed: true };
    }
  }

  async get(reservationId: string, tokenHash: string): Promise<ReservationView> {
    const reservation = await this.findReservation(this.prisma, 'id', reservationId);
    if (!reservation) throw new ReservationNotFoundError();
    if (!safeCompare(reservation.continuation_token_hash, tokenHash)) throw new InvalidReservationTokenError();
    if (reservation.status === 'EXPIRED' || reservation.expires_at <= new Date()) throw new ReservationExpiredError();
    return toView(reservation, await this.findItems(this.prisma, reservation.id));
  }

  async cancel(reservationId: string, tokenHash: string): Promise<void> {
    return this.cancelWithRetries(reservationId, tokenHash, 0);
  }

  private async cancelWithRetries(reservationId: string, tokenHash: string, attempt: number): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Lock the reservation row for update to prevent concurrent cancels from
        // double-decrementing inventory between the read and the UPDATE.
        const locked = await tx.$queryRaw<ReservationRow[]>`
          SELECT id, status, expires_at, currency, subtotal_amount, continuation_token_hash, organization_id, event_id
          FROM reservations
          WHERE id = ${reservationId}::uuid
          FOR UPDATE
        `;
        const reservation = locked[0] ?? null;
        if (!reservation) throw new ReservationNotFoundError();
        if (!safeCompare(reservation.continuation_token_hash, tokenHash)) throw new InvalidReservationTokenError();
        // Treat an expired-but-still-ACTIVE reservation as expired
        if (reservation.status === 'EXPIRED' || reservation.expires_at <= new Date()) return;
        if (reservation.status === 'CONSUMED') throw new ReservationAlreadyConsumedError();
        if (reservation.status === 'CANCELLED') return;
        const items = await this.findItems(tx, reservation.id);
        for (const item of items) {
          await tx.$executeRaw`UPDATE ticket_inventory SET reserved = GREATEST(reserved - ${item.quantity}, 0), version = version + 1, updated_at = NOW() WHERE ticket_type_id = ${item.ticket_type_id}::uuid AND organization_id = ${reservation.organization_id}::uuid`;
        }
        await tx.$executeRaw`UPDATE reservations SET status = 'CANCELLED', updated_at = NOW() WHERE id = ${reservation.id}::uuid AND status = 'ACTIVE'`;
        await tx.outboxEvent.create({ data: { aggregateType: 'reservation', aggregateId: reservation.id, type: 'reservation.cancelled.v1', version: '1', organizationId: reservation.organization_id, payload: { reservationId: reservation.id, eventId: reservation.event_id, organizationId: reservation.organization_id } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    } catch (error) {
      if (isSerializationFailure(error) && attempt < 2) {
        const delayMs = Math.min((50 + Math.random() * 50) * 2 ** attempt, 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.cancelWithRetries(reservationId, tokenHash, attempt + 1);
      }
      throw error;
    }
  }

  async expireActiveReservations(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // Bulk expire all active past-due reservations in a single UPDATE RETURNING.
      const expired = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE status = 'ACTIVE' AND expires_at <= NOW()
        RETURNING id
      `;

      if (expired.length === 0) return 0;

      const ids = expired.map((r) => r.id);

      // Bulk update inventory: aggregate quantities across all expired reservations
      // grouped by ticket_type_id + organization_id, then decrement in one pass.
      await tx.$executeRaw`
        UPDATE ticket_inventory ti
        SET
          reserved = GREATEST(ti.reserved - agg.total_quantity, 0),
          version   = ti.version + 1,
          updated_at = NOW()
        FROM (
          SELECT
            ri.ticket_type_id,
            r.organization_id,
            SUM(ri.quantity)::int AS total_quantity
          FROM reservation_items ri
          JOIN reservations r ON r.id = ri.reservation_id
          WHERE r.id = ANY(${ids}::uuid[])
          GROUP BY ri.ticket_type_id, r.organization_id
        ) AS agg
        WHERE ti.ticket_type_id = agg.ticket_type_id
          AND ti.organization_id = agg.organization_id
      `;

      return expired.length;
    });
  }

  private async expireHoldsForTicketTypes(tx: TransactionClient, ticketTypeIds: string[]): Promise<void> {
    // Find all expired active reservations touching any of the requested ticket types (single query).
    const toExpire = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT r.id
      FROM reservations r
      JOIN reservation_items ri ON ri.reservation_id = r.id
      WHERE r.status = 'ACTIVE'
        AND r.expires_at <= NOW()
        AND ri.ticket_type_id = ANY(${ticketTypeIds}::uuid[])
    `;
    if (toExpire.length === 0) return;

    const ids = toExpire.map((r) => r.id);

    // Bulk expire reservations (single UPDATE).
    await tx.$executeRaw`
      UPDATE reservations
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE id = ANY(${ids}::uuid[])
        AND status = 'ACTIVE'
        AND expires_at <= NOW()
    `;

    // Bulk release inventory — same pattern as expireActiveReservations (single UPDATE FROM).
    await tx.$executeRaw`
      UPDATE ticket_inventory ti
      SET
        reserved   = GREATEST(ti.reserved - agg.total_quantity, 0),
        version    = ti.version + 1,
        updated_at = NOW()
      FROM (
        SELECT
          ri.ticket_type_id,
          r.organization_id,
          SUM(ri.quantity)::int AS total_quantity
        FROM reservation_items ri
        JOIN reservations r ON r.id = ri.reservation_id
        WHERE r.id = ANY(${ids}::uuid[])
        GROUP BY ri.ticket_type_id, r.organization_id
      ) AS agg
      WHERE ti.ticket_type_id = agg.ticket_type_id
        AND ti.organization_id = agg.organization_id
    `;
  }

  private async findReservation(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, column: 'id' | 'idempotency_key', value: string): Promise<ReservationRow | null> {
    const rows = column === 'id'
      ? await client.$queryRaw<ReservationRow[]>`SELECT id, status, expires_at, currency, subtotal_amount, continuation_token_hash, organization_id, event_id FROM reservations WHERE id = ${value}::uuid LIMIT 1`
      : await client.$queryRaw<ReservationRow[]>`SELECT id, status, expires_at, currency, subtotal_amount, continuation_token_hash, organization_id, event_id FROM reservations WHERE idempotency_key = ${value} LIMIT 1`;
    return rows[0] ?? null;
  }

  private async findItems(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, reservationId: string): Promise<ReservationItemRow[]> {
    return client.$queryRaw<ReservationItemRow[]>`SELECT ticket_type_id, name_snapshot, quantity, unit_price_amount, subtotal_amount FROM reservation_items WHERE reservation_id = ${reservationId}::uuid ORDER BY ticket_type_id`;
  }
}
