import * as crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CancelPostPaymentOrderParams,
  CancelPostPaymentOrderResult,
  CancelPrePaymentOrderParams,
  IOrderCancellationRepository,
  OrderForCancellation,
} from '../../application/ports/order-cancellation-repository.port';
import { OrderNotCancellableError } from '../../domain/cancellation.errors';

interface RawOrderRow {
  id: string;
  organization_id: string;
  event_id: string;
  reservation_id: string;
  status: string;
  total_amount: bigint;
  currency: string;
  buyer_email: string | null;
}

interface RawOrderItemRow {
  ticket_type_id: string;
  quantity: number;
}

interface RawTicketRow {
  id: string;
}

@Injectable()
export class PrismaOrderCancellationRepository implements IOrderCancellationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForCancellation(organizationId: string, orderId: string): Promise<OrderForCancellation | null> {
    const rows = await this.prisma.$queryRaw<RawOrderRow[]>`
      SELECT id, organization_id, event_id, reservation_id, status, total_amount, currency
      FROM orders
      WHERE id = ${orderId}::uuid
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const items = await this.prisma.$queryRaw<RawOrderItemRow[]>`
      SELECT ticket_type_id, quantity
      FROM order_items
      WHERE order_id = ${orderId}::uuid
    `;

    return {
      id: row.id,
      organizationId: row.organization_id,
      eventId: row.event_id,
      reservationId: row.reservation_id,
      status: row.status,
      totalAmount: row.total_amount,
      currency: row.currency,
      items: items.map((i) => ({ ticketTypeId: i.ticket_type_id, quantity: i.quantity })),
    };
  }

  async findForCancellationByToken(orderId: string, token: string): Promise<OrderForCancellation | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await this.prisma.$queryRaw<RawOrderRow[]>`
      SELECT o.id, o.organization_id, o.event_id, o.reservation_id, o.status, o.total_amount, o.currency
      FROM orders o
      JOIN reservations r ON r.id = o.reservation_id
      WHERE o.id = ${orderId}::uuid
        AND r.continuation_token_hash = ${tokenHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const items = await this.prisma.$queryRaw<RawOrderItemRow[]>`
      SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ${orderId}::uuid
    `;
    return {
      id: row.id,
      organizationId: row.organization_id,
      eventId: row.event_id,
      reservationId: row.reservation_id,
      status: row.status,
      totalAmount: row.total_amount,
      currency: row.currency,
      items: items.map((i) => ({ ticketTypeId: i.ticket_type_id, quantity: i.quantity })),
    };
  }

  async hasAdmittedCheckInForOrder(organizationId: string, orderId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM check_ins ci
      JOIN tickets t ON t.id = ci.ticket_id
      WHERE t.order_id = ${orderId}::uuid
        AND ci.organization_id = ${organizationId}::uuid
        AND ci.result = 'ADMITTED'
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async hasPendingTransferForOrder(organizationId: string, orderId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM ticket_transfers tt
      JOIN tickets t ON t.id = tt.ticket_id
      WHERE t.order_id = ${orderId}::uuid
        AND tt.organization_id = ${organizationId}::uuid
        AND tt.status = 'PENDING'
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async cancelPrePaymentOrder(params: CancelPrePaymentOrderParams): Promise<void> {
    const { orderId, organizationId, source, reason, actorId } = params;

    await this.prisma.$transaction(async (tx) => {
      // 1. Lock and re-verify status
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; buyer_email: string | null }>>`
        SELECT id, status, buyer_email FROM orders
        WHERE id = ${orderId}::uuid
          AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;
      const order = rows[0];
      if (!order || order.status === 'CANCELLED') return; // idempotent
      if (order.status !== 'PENDING_PAYMENT') {
        throw new Error(`Cannot cancel order in status ${order.status}`);
      }

      // 2. Cancel active payment attempt
      await tx.$executeRaw`
        UPDATE payment_attempts
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE order_id = ${orderId}::uuid
          AND status = 'PENDING'
      `;

      // 3. Release reserved inventory for each order item
      await tx.$executeRaw`
        UPDATE ticket_inventory ti
        SET reserved = ti.reserved - oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE oi.order_id = ${orderId}::uuid
          AND ti.ticket_type_id = oi.ticket_type_id
          AND ti.organization_id = ${organizationId}::uuid
          AND ti.reserved >= oi.quantity
      `;

      // 4. Cancel order
      const cancelledAt = new Date();
      await tx.$executeRaw`
        UPDATE orders
        SET status = 'CANCELLED',
            cancelled_at = ${cancelledAt},
            cancellation_source = ${source},
            cancellation_reason = ${reason ?? null},
            updated_at = NOW()
        WHERE id = ${orderId}::uuid
      `;

      // 5. Audit entry
      if (actorId) {
        await tx.$executeRaw`
          INSERT INTO audit_entries (id, organization_id, user_id, action, resource_type, resource_id, metadata, occurred_at)
          VALUES (
            gen_random_uuid(),
            ${organizationId}::uuid,
            ${actorId}::uuid,
            'order.cancelled',
            'order',
            ${orderId},
            ${JSON.stringify({ source, reason: reason ?? null })}::jsonb,
            NOW()
          )
        `;
      }

      // 6. Outbox event
      await tx.$executeRaw`
        INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
        VALUES (
          gen_random_uuid(),
          'order',
          ${orderId},
          'order.cancelled.v1',
          '1',
          ${JSON.stringify({ orderId, organizationId, source, requiresRefund: false, buyerEmail: order.buyer_email ?? null })}::jsonb,
          ${organizationId}::uuid,
          NOW()
        )
      `;
    });
  }

  async cancelPostPaymentOrder(params: CancelPostPaymentOrderParams): Promise<CancelPostPaymentOrderResult> {
    const { orderId, organizationId, source, reason, actorId } = params;
    let cancelledTicketIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 1. Lock and re-verify
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; buyer_email: string | null }>>`
        SELECT id, status, buyer_email FROM orders
        WHERE id = ${orderId}::uuid
          AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;
      const order = rows[0];
      if (!order || order.status === 'CANCELLED') return; // idempotent
      if (order.status !== 'TICKETS_ISSUED') {
        throw new Error(`Cannot cancel post-payment order in status ${order.status}`);
      }

      // 2. Re-check blocking conditions under lock (prevents TOCTOU between eligibility read and this transaction)
      const [checkInRows, transferRows] = await Promise.all([
        tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS count
          FROM check_ins ci
          JOIN tickets t ON t.id = ci.ticket_id
          WHERE t.order_id = ${orderId}::uuid
            AND ci.organization_id = ${organizationId}::uuid
            AND ci.result = 'ADMITTED'
        `,
        tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS count
          FROM ticket_transfers tt
          JOIN tickets t ON t.id = tt.ticket_id
          WHERE t.order_id = ${orderId}::uuid
            AND tt.organization_id = ${organizationId}::uuid
            AND tt.status = 'PENDING'
        `,
      ]);
      if (Number(checkInRows[0]?.count ?? 0) > 0) throw new OrderNotCancellableError('TICKET_ALREADY_USED');
      if (Number(transferRows[0]?.count ?? 0) > 0) throw new OrderNotCancellableError('TICKET_TRANSFER_PENDING');

      // 4. Cancel tickets and get their IDs
      const ticketRows = await tx.$queryRaw<RawTicketRow[]>`
        UPDATE tickets
        SET status = 'CANCELLED',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE order_id = ${orderId}::uuid
          AND organization_id = ${organizationId}::uuid
          AND status = 'ACTIVE'
        RETURNING id
      `;
      cancelledTicketIds = ticketRows.map((r) => r.id);

      // 5. Revoke active credentials for cancelled tickets (bulk UPDATE)
      if (cancelledTicketIds.length > 0) {
        await tx.$executeRaw`
          UPDATE ticket_credentials
          SET status = 'REVOKED',
              revoked_at = NOW()
          WHERE ticket_id = ANY(${cancelledTicketIds}::uuid[])
            AND status = 'ACTIVE'
        `;
      }

      // 6. Release committed inventory
      await tx.$executeRaw`
        UPDATE ticket_inventory ti
        SET committed = ti.committed - oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE oi.order_id = ${orderId}::uuid
          AND ti.ticket_type_id = oi.ticket_type_id
          AND ti.organization_id = ${organizationId}::uuid
          AND ti.committed >= oi.quantity
      `;

      // 7. Cancel order
      const cancelledAt = new Date();
      await tx.$executeRaw`
        UPDATE orders
        SET status = 'CANCELLED',
            cancelled_at = ${cancelledAt},
            cancellation_source = ${source},
            cancellation_reason = ${reason ?? null},
            updated_at = NOW()
        WHERE id = ${orderId}::uuid
      `;

      // 8. Audit entry
      if (actorId) {
        await tx.$executeRaw`
          INSERT INTO audit_entries (id, organization_id, user_id, action, resource_type, resource_id, metadata, occurred_at)
          VALUES (
            gen_random_uuid(),
            ${organizationId}::uuid,
            ${actorId}::uuid,
            'order.cancelled',
            'order',
            ${orderId},
            ${JSON.stringify({ source, reason: reason ?? null, ticketCount: cancelledTicketIds.length })}::jsonb,
            NOW()
          )
        `;
      }

      // 9. Outbox: order.cancelled.v1
      await tx.$executeRaw`
        INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
        VALUES (
          gen_random_uuid(),
          'order',
          ${orderId},
          'order.cancelled.v1',
          '1',
          ${JSON.stringify({ orderId, organizationId, source, requiresRefund: true, buyerEmail: order.buyer_email ?? null })}::jsonb,
          ${organizationId}::uuid,
          NOW()
        )
      `;

      // 10. Outbox: ticket.cancelled.v1 — bulk INSERT for all cancelled tickets
      if (cancelledTicketIds.length > 0) {
        const rows = cancelledTicketIds.map((ticketId) =>
          Prisma.sql`(gen_random_uuid(), 'ticket', ${ticketId}::uuid, 'ticket.cancelled.v1', '1', ${JSON.stringify({ ticketId, orderId, organizationId })}::jsonb, ${organizationId}::uuid, NOW())`,
        );
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at) VALUES ${Prisma.join(rows)}`,
        );
      }
    });

    return { cancelledTicketIds };
  }
}
