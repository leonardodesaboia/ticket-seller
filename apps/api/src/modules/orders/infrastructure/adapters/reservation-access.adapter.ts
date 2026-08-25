import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  InvalidReservationTokenForOrderError, OrderAlreadyExistsError, OrderIdempotencyConflictError,
  ReservationAlreadyConsumedForOrderError, ReservationCancelledForOrderError, ReservationExpiredForOrderError,
  ReservationNotFoundForOrderError,
} from '../../domain/order.errors';
import type { OrderView, OrderViewItem } from '../../domain/ports/order-repository.port';
import type { CreateOrderFromReservationInput, IReservationAccess } from '../../application/ports/reservation-access.port';

type TransactionClient = Prisma.TransactionClient;
const MAX_RETRIES = 2;

interface ReservationRow { id: string; organization_id: string; event_id: string; status: string; continuation_token_hash: string; expires_at: Date; currency: string; subtotal_amount: bigint; }
interface ItemRow { ticket_type_id: string; name_snapshot: string; quantity: number; unit_price_amount: bigint; subtotal_amount: bigint; }
interface OrderRow { id: string; reservation_id: string; status: string; currency: string; subtotal_amount: bigint; total_amount: bigint; expires_at: Date; }

function amount(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Order amount exceeds JavaScript safe integer range');
  return result;
}

function isRetryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || String(error.message).includes('40001') || String(error.message).includes('40P01'));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class PrismaReservationAccessAdapter implements IReservationAccess {
  constructor(private readonly prisma: PrismaService) {}

  createOrderFromActiveReservation(input: CreateOrderFromReservationInput): Promise<OrderView> {
    return this.createWithRetries(input, 0);
  }

  private async createWithRetries(input: CreateOrderFromReservationInput, attempt: number): Promise<OrderView> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const reservation = await this.findReservation(tx, input.reservationId);
        if (!reservation) throw new ReservationNotFoundForOrderError();
        if (reservation.continuation_token_hash !== input.tokenHash) throw new InvalidReservationTokenForOrderError();
        // Validate reservation state BEFORE writing idempotency record to avoid
        // recording a key for a request that will always fail on retry.
        if (reservation.status === 'EXPIRED' || reservation.expires_at <= new Date()) throw new ReservationExpiredForOrderError();
        if (reservation.status === 'CANCELLED') throw new ReservationCancelledForOrderError();
        if (reservation.status === 'CONSUMED') throw new ReservationAlreadyConsumedForOrderError();
        if (await this.findOrderByReservation(tx, reservation.id)) throw new OrderAlreadyExistsError();
        await tx.idempotencyRecord.create({ data: { idempotencyKey: `order-create:${input.idempotencyKey}`, requestHash: input.requestHash, expiresAt: reservation.expires_at } });

        const rows = await tx.$queryRaw<OrderRow[]>`
          INSERT INTO orders (organization_id, event_id, reservation_id, status, currency, subtotal_amount, total_amount, idempotency_key, expires_at, buyer_email)
          VALUES (${reservation.organization_id}::uuid, ${reservation.event_id}::uuid, ${reservation.id}::uuid, 'PENDING_PAYMENT', ${reservation.currency}, ${reservation.subtotal_amount}, ${reservation.subtotal_amount}, ${input.idempotencyKey}, ${reservation.expires_at}, ${input.buyerEmail})
          RETURNING id, reservation_id, status, currency, subtotal_amount, total_amount, expires_at
        `;
        const order = rows[0];
        if (!order) throw new Error('Order insert did not return a row');
        const items = await this.findItems(tx, reservation.id);
        for (const item of items) {
          await tx.$executeRaw`
            INSERT INTO order_items (order_id, ticket_type_id, name_snapshot, unit_price_amount, quantity, subtotal_amount)
            VALUES (${order.id}::uuid, ${item.ticket_type_id}::uuid, ${item.name_snapshot}, ${item.unit_price_amount}, ${item.quantity}, ${item.subtotal_amount})
          `;
        }
        const consumed = await tx.$executeRaw`
          UPDATE reservations SET status = 'CONSUMED', updated_at = NOW()
          WHERE id = ${reservation.id}::uuid AND status = 'ACTIVE' AND expires_at > NOW()
        `;
        if (consumed !== 1) throw new ReservationAlreadyConsumedForOrderError();
        const view = toView(order, items);
        await tx.outboxEvent.create({ data: { aggregateType: 'order', aggregateId: order.id, type: 'order.created.v1', version: '1', organizationId: reservation.organization_id, payload: { orderId: order.id, reservationId: reservation.id, eventId: reservation.event_id, organizationId: reservation.organization_id, buyerEmail: input.buyerEmail } } });
        await tx.idempotencyRecord.update({ where: { idempotencyKey: `order-create:${input.idempotencyKey}` }, data: { responseStatus: 201, responseBody: JSON.parse(JSON.stringify(view)) as Prisma.InputJsonValue, completedAt: new Date() } });
        return view;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isRetryable(error) && attempt < MAX_RETRIES) return this.createWithRetries(input, attempt + 1);
      if (isUniqueViolation(error)) return this.resolveUniqueConflict(input);
      throw error;
    }
  }

  private async resolveUniqueConflict(input: CreateOrderFromReservationInput): Promise<OrderView> {
    const reservation = await this.findReservation(this.prisma, input.reservationId);
    if (!reservation) throw new ReservationNotFoundForOrderError();
    if (reservation.continuation_token_hash !== input.tokenHash) throw new InvalidReservationTokenForOrderError();
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { idempotencyKey: `order-create:${input.idempotencyKey}` } });
    if (record) {
      if (record.requestHash !== input.requestHash || !record.completedAt) throw new OrderIdempotencyConflictError();
      const replay = await this.findOrderByIdempotencyKey(this.prisma, input.idempotencyKey);
      if (replay) return toView(replay, await this.findOrderItems(this.prisma, replay.id));
    }
    if (await this.findOrderByReservation(this.prisma, input.reservationId)) throw new OrderAlreadyExistsError();
    throw new OrderIdempotencyConflictError();
  }

  private async findReservation(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, id: string): Promise<ReservationRow | null> {
    const rows = await client.$queryRaw<ReservationRow[]>`SELECT id, organization_id, event_id, status, continuation_token_hash, expires_at, currency, subtotal_amount FROM reservations WHERE id = ${id}::uuid LIMIT 1`;
    return rows[0] ?? null;
  }

  private async findItems(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, reservationId: string): Promise<ItemRow[]> {
    return client.$queryRaw<ItemRow[]>`SELECT ticket_type_id, name_snapshot, quantity, unit_price_amount, subtotal_amount FROM reservation_items WHERE reservation_id = ${reservationId}::uuid ORDER BY ticket_type_id`;
  }

  private async findOrderByReservation(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, reservationId: string): Promise<OrderRow | null> {
    const rows = await client.$queryRaw<OrderRow[]>`SELECT id, reservation_id, status, currency, subtotal_amount, total_amount, expires_at FROM orders WHERE reservation_id = ${reservationId}::uuid LIMIT 1`;
    return rows[0] ?? null;
  }

  private async findOrderByIdempotencyKey(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, key: string): Promise<OrderRow | null> {
    const rows = await client.$queryRaw<OrderRow[]>`SELECT id, reservation_id, status, currency, subtotal_amount, total_amount, expires_at FROM orders WHERE idempotency_key = ${key} LIMIT 1`;
    return rows[0] ?? null;
  }

  private async findOrderItems(client: Pick<PrismaService, '$queryRaw'> | TransactionClient, orderId: string): Promise<ItemRow[]> {
    return client.$queryRaw<ItemRow[]>`SELECT ticket_type_id, name_snapshot, quantity, unit_price_amount, subtotal_amount FROM order_items WHERE order_id = ${orderId}::uuid ORDER BY ticket_type_id`;
  }
}

function toView(order: OrderRow, items: ItemRow[]): OrderView {
  return { orderId: order.id, reservationId: order.reservation_id, status: order.status as OrderView['status'], currency: order.currency, subtotalAmount: amount(order.subtotal_amount), totalAmount: amount(order.total_amount), expiresAt: order.expires_at.toISOString(), items: items.map((item): OrderViewItem => ({ ticketTypeId: item.ticket_type_id, name: item.name_snapshot, quantity: item.quantity, unitPriceAmount: amount(item.unit_price_amount), subtotalAmount: amount(item.subtotal_amount) })) };
}
