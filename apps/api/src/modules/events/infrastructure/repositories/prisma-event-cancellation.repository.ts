import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CancelEventParams,
  CancelEventResult,
  IEventCancellationRepository,
} from '../../application/ports/event-cancellation-repository.port';

interface RawOrderRow {
  id: string;
  status: string;
  organization_id: string;
}

interface RawTicketRow {
  id: string;
}

const CHUNK_SIZE = 100;

@Injectable()
export class PrismaEventCancellationRepository implements IEventCancellationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getEventStatus(eventId: string, organizationId: string): Promise<{ status: string } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM events
      WHERE id = ${eventId}::uuid
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { status: row.status };
  }

  async cancelEvent(params: CancelEventParams): Promise<CancelEventResult> {
    const { eventId, organizationId, reason, actorId } = params;
    let ordersCancelledCount = 0;

    await this.prisma.$transaction(async (tx) => {
      // a. UPDATE events SET status='CANCELLED', cancelled_at=NOW()
      //    Only proceeds if the event is not already CANCELLED (optimistic check under lock)
      const updatedEvents = await tx.$queryRaw<Array<{ id: string; cancelled_at: Date }>>`
        UPDATE events
        SET status = 'CANCELLED',
            cancelled_at = NOW(),
            cancellation_reason = ${reason ?? null},
            updated_at = NOW()
        WHERE id = ${eventId}::uuid
          AND organization_id = ${organizationId}::uuid
          AND status != 'CANCELLED'
        RETURNING id, cancelled_at
      `;

      // If nothing was updated, the event is already cancelled (idempotent guard)
      if (updatedEvents.length === 0) {
        return;
      }

      // b. Buscar e cancelar orders elegíveis em chunks de 100
      let offset = 0;

      for (;;) {
        const orders = await tx.$queryRaw<RawOrderRow[]>`
          SELECT id, status, organization_id
          FROM orders
          WHERE event_id = ${eventId}::uuid
            AND status IN ('PENDING_PAYMENT', 'TICKETS_ISSUED')
          FOR UPDATE
          LIMIT ${CHUNK_SIZE} OFFSET ${offset}
        `;

        if (orders.length === 0) {
          break;
        }

        for (const order of orders) {
          const orderId = order.id;
          const orderOrgId = order.organization_id;

          if (order.status === 'PENDING_PAYMENT') {
            // Cancel active payment attempts
            await tx.$executeRaw`
              UPDATE payment_attempts
              SET status = 'CANCELLED', updated_at = NOW()
              WHERE order_id = ${orderId}::uuid
                AND status = 'PENDING'
            `;

            // Release reserved inventory for each order item
            await tx.$executeRaw`
              UPDATE ticket_inventory ti
              SET reserved = ti.reserved - oi.quantity,
                  updated_at = NOW()
              FROM order_items oi
              WHERE oi.order_id = ${orderId}::uuid
                AND ti.ticket_type_id = oi.ticket_type_id
                AND ti.organization_id = ${orderOrgId}::uuid
                AND ti.reserved >= oi.quantity
            `;

            // Cancel order
            await tx.$executeRaw`
              UPDATE orders
              SET status = 'CANCELLED',
                  cancelled_at = NOW(),
                  cancellation_source = 'ADMIN',
                  cancellation_reason = ${reason ?? null},
                  updated_at = NOW()
              WHERE id = ${orderId}::uuid
            `;

            // c. Outbox: order.cancelled.v1 with requiresRefund: false
            await tx.$executeRaw`
              INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
              VALUES (
                gen_random_uuid(),
                'order',
                ${orderId},
                'order.cancelled.v1',
                '1',
                ${JSON.stringify({ orderId, organizationId: orderOrgId, source: 'ADMIN', requiresRefund: false, reason: reason ?? null })}::jsonb,
                ${orderOrgId}::uuid,
                NOW()
              )
            `;
          } else if (order.status === 'TICKETS_ISSUED') {
            // Cancel tickets and get their IDs
            const ticketRows = await tx.$queryRaw<RawTicketRow[]>`
              UPDATE tickets
              SET status = 'CANCELLED',
                  cancelled_at = NOW(),
                  updated_at = NOW()
              WHERE order_id = ${orderId}::uuid
                AND organization_id = ${orderOrgId}::uuid
                AND status = 'ACTIVE'
              RETURNING id
            `;

            // Revoke active credentials for cancelled tickets
            for (const ticket of ticketRows) {
              await tx.$executeRaw`
                UPDATE ticket_credentials
                SET status = 'REVOKED',
                    revoked_at = NOW()
                WHERE ticket_id = ${ticket.id}::uuid
                  AND status = 'ACTIVE'
              `;
            }

            // Release committed inventory
            await tx.$executeRaw`
              UPDATE ticket_inventory ti
              SET committed = ti.committed - oi.quantity,
                  updated_at = NOW()
              FROM order_items oi
              WHERE oi.order_id = ${orderId}::uuid
                AND ti.ticket_type_id = oi.ticket_type_id
                AND ti.organization_id = ${orderOrgId}::uuid
                AND ti.committed >= oi.quantity
            `;

            // Cancel order
            await tx.$executeRaw`
              UPDATE orders
              SET status = 'CANCELLED',
                  cancelled_at = NOW(),
                  cancellation_source = 'ADMIN',
                  cancellation_reason = ${reason ?? null},
                  updated_at = NOW()
              WHERE id = ${orderId}::uuid
            `;

            // c. Outbox: order.cancelled.v1 with requiresRefund: true
            await tx.$executeRaw`
              INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
              VALUES (
                gen_random_uuid(),
                'order',
                ${orderId},
                'order.cancelled.v1',
                '1',
                ${JSON.stringify({ orderId, organizationId: orderOrgId, source: 'ADMIN', requiresRefund: true, reason: reason ?? null })}::jsonb,
                ${orderOrgId}::uuid,
                NOW()
              )
            `;

            // Outbox: ticket.cancelled.v1 for each ticket
            for (const ticket of ticketRows) {
              await tx.$executeRaw`
                INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
                VALUES (
                  gen_random_uuid(),
                  'ticket',
                  ${ticket.id},
                  'ticket.cancelled.v1',
                  '1',
                  ${JSON.stringify({ ticketId: ticket.id, orderId, organizationId: orderOrgId })}::jsonb,
                  ${orderOrgId}::uuid,
                  NOW()
                )
              `;
            }
          }

          ordersCancelledCount++;
        }

        if (orders.length < CHUNK_SIZE) {
          break;
        }
        offset += CHUNK_SIZE;
      }

      // d. Outbox: event.cancelled.v1
      await tx.$executeRaw`
        INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
        VALUES (
          gen_random_uuid(),
          'event',
          ${eventId},
          'event.cancelled.v1',
          '1',
          ${JSON.stringify({ eventId, organizationId, reason: reason ?? null, ordersCancelledCount })}::jsonb,
          ${organizationId}::uuid,
          NOW()
        )
      `;

      // e. Audit entry if actorId provided
      if (actorId) {
        await tx.$executeRaw`
          INSERT INTO audit_entries (id, organization_id, user_id, action, resource_type, resource_id, metadata, occurred_at)
          VALUES (
            gen_random_uuid(),
            ${organizationId}::uuid,
            ${actorId}::uuid,
            'event.cancelled',
            'event',
            ${eventId},
            ${JSON.stringify({ reason: reason ?? null, ordersCancelledCount })}::jsonb,
            NOW()
          )
        `;
      }
    });

    const cancelledAt = new Date();
    return {
      eventId,
      organizationId,
      status: 'CANCELLED',
      cancelledAt,
      ordersCancelledCount,
    };
  }
}
