import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TicketInventory } from '../../domain/ticket-inventory.entity';
import { InsufficientInventoryError, InventoryNotFoundError } from '../../domain/inventory.errors';
import type {
  AvailabilityResult,
  IInventoryRepository,
  InitializeInventoryItem,
} from '../../domain/ports/inventory-repository.port';

interface RawInventoryRow {
  id: string;
  ticket_type_id: string;
  event_id: string;
  organization_id: string;
  capacity: number;
  reserved: number;
  committed: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface RawAvailabilityRow {
  ticket_type_id: string;
  available_quantity: bigint | number;
}

function toEntity(row: RawInventoryRow): TicketInventory {
  return new TicketInventory({
    id: row.id,
    ticketTypeId: row.ticket_type_id,
    eventId: row.event_id,
    organizationId: row.organization_id,
    capacity: row.capacity,
    reserved: row.reserved,
    committed: row.committed,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTicketTypeId(
    organizationId: string,
    ticketTypeId: string,
  ): Promise<TicketInventory | null> {
    const rows = await this.prisma.$queryRaw<RawInventoryRow[]>`
      SELECT id, ticket_type_id, event_id, organization_id,
             capacity, reserved, committed, version, created_at, updated_at
      FROM ticket_inventory
      WHERE ticket_type_id = ${ticketTypeId}::uuid
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByEventId(organizationId: string, eventId: string): Promise<TicketInventory[]> {
    const rows = await this.prisma.$queryRaw<RawInventoryRow[]>`
      SELECT id, ticket_type_id, event_id, organization_id,
             capacity, reserved, committed, version, created_at, updated_at
      FROM ticket_inventory
      WHERE event_id = ${eventId}::uuid
        AND organization_id = ${organizationId}::uuid
    `;
    return rows.map(toEntity);
  }

  async initializeForEvent(items: InitializeInventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    for (const item of items) {
      await this.prisma.$executeRaw`
        INSERT INTO ticket_inventory
          (ticket_type_id, event_id, organization_id, capacity)
        VALUES
          (${item.ticketTypeId}::uuid, ${item.eventId}::uuid, ${item.organizationId}::uuid, ${item.capacity})
        ON CONFLICT (ticket_type_id) DO NOTHING
      `;
    }
  }

  async tryReserve(
    organizationId: string,
    ticketTypeId: string,
    quantity: number,
  ): Promise<TicketInventory> {
    const rows = await this.prisma.$queryRaw<RawInventoryRow[]>`
      UPDATE ticket_inventory
      SET reserved    = reserved + ${quantity},
          version     = version + 1,
          updated_at  = NOW()
      WHERE ticket_type_id = ${ticketTypeId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND (capacity - reserved - committed) >= ${quantity}
      RETURNING id, ticket_type_id, event_id, organization_id,
                capacity, reserved, committed, version, created_at, updated_at
    `;

    if (rows.length === 0) {
      throw new InsufficientInventoryError(ticketTypeId);
    }

    return toEntity(rows[0]!);
  }

  async releaseHold(
    organizationId: string,
    ticketTypeId: string,
    quantity: number,
  ): Promise<void> {
    const affected = await this.prisma.$executeRaw`
      UPDATE ticket_inventory
      SET reserved   = GREATEST(reserved - ${quantity}, 0),
          version    = version + 1,
          updated_at = NOW()
      WHERE ticket_type_id = ${ticketTypeId}::uuid
        AND organization_id = ${organizationId}::uuid
    `;
    if (affected === 0) {
      throw new InventoryNotFoundError(ticketTypeId);
    }
  }

  async getAvailability(ticketTypeIds: string[], organizationId: string): Promise<AvailabilityResult[]> {
    if (ticketTypeIds.length === 0) return [];

    const rows = await this.prisma.$queryRaw<RawAvailabilityRow[]>`
      SELECT ti.ticket_type_id,
             (ti.capacity - COALESCE(active.total_reserved, 0) - ti.committed) AS available_quantity
      FROM ticket_inventory ti
      LEFT JOIN (
        SELECT ri.ticket_type_id, SUM(ri.quantity) AS total_reserved
        FROM reservation_items ri
        JOIN reservations r ON r.id = ri.reservation_id
        WHERE r.status = 'ACTIVE' AND r.expires_at > NOW()
        GROUP BY ri.ticket_type_id
      ) active ON active.ticket_type_id = ti.ticket_type_id
      WHERE ti.ticket_type_id = ANY(${ticketTypeIds}::uuid[])
        AND ti.organization_id = ${organizationId}::uuid
      ORDER BY ti.ticket_type_id
    `;

    return rows.map((row) => ({
      ticketTypeId: row.ticket_type_id,
      availableQuantity: Number(row.available_quantity),
    }));
  }
}
