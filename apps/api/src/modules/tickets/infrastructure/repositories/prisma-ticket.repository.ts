import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { Ticket, TicketStatus } from '../../domain/ticket.entity';
import { CreateTicketData, ITicketRepository } from '../../domain/ports/ticket-repository.port';

interface RawTicketRow {
  id: string;
  organization_id: string;
  event_id: string;
  order_id: string;
  order_item_id: string;
  ticket_type_id: string;
  unit_index: number;
  public_code: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: RawTicketRow): Ticket {
  return new Ticket({
    id: row.id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    ticketTypeId: row.ticket_type_id,
    unitIndex: row.unit_index,
    publicCode: row.public_code,
    status: row.status as TicketStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class PrismaTicketRepository implements ITicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createIfNotExists(data: CreateTicketData): Promise<Ticket | null> {
    // Attempt insert; ON CONFLICT (order_item_id, unit_index) DO NOTHING returns 0 rows
    const rows = await this.prisma.$queryRaw<RawTicketRow[]>`
      INSERT INTO tickets
        (id, organization_id, event_id, order_id, order_item_id, ticket_type_id, unit_index, public_code)
      VALUES
        (${data.id}::uuid, ${data.organizationId}::uuid, ${data.eventId}::uuid,
         ${data.orderId}::uuid, ${data.orderItemId}::uuid, ${data.ticketTypeId}::uuid,
         ${data.unitIndex}, ${data.publicCode})
      ON CONFLICT (order_item_id, unit_index) DO NOTHING
      RETURNING *
    `;
    // If conflict: return existing ticket
    if (rows.length === 0) {
      const existing = await this.prisma.$queryRaw<RawTicketRow[]>`
        SELECT * FROM tickets
        WHERE order_item_id = ${data.orderItemId}::uuid AND unit_index = ${data.unitIndex}
        LIMIT 1
      `;
      return existing[0] ? toEntity(existing[0]) : null;
    }
    return toEntity(rows[0]!);
  }

  async findByOrderId(orderId: string, organizationId: string): Promise<Ticket[]> {
    const rows = await this.prisma.$queryRaw<RawTicketRow[]>`
      SELECT * FROM tickets
      WHERE order_id = ${orderId}::uuid
        AND organization_id = ${organizationId}::uuid
      ORDER BY order_item_id, unit_index
    `;
    return rows.map(toEntity);
  }
}
