import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TicketType } from '../../domain/ticket-types/ticket-type.entity';
import { EventNotFoundError, EventNotInDraftError } from '../../domain/event.errors';
import {
  TicketTypeVersionConflictError,
  TicketTypeNotFoundError,
} from '../../domain/ticket-types/ticket-type.errors';
import type {
  ITicketTypeRepository,
  UpdateTicketTypeInput,
} from '../../domain/ticket-types/ticket-type-repository.port';
import type { TicketType as PrismaTicketType } from '@prisma/client';

@Injectable()
export class PrismaTicketTypeRepository implements ITicketTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEventAndId(eventId: string, ticketTypeId: string): Promise<TicketType | null> {
    const row = await this.prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
    });
    if (!row) return null;
    return this.toEntity(row);
  }

  async findByEvent(eventId: string, organizationId: string): Promise<TicketType[]> {
    const rows = await this.prisma.ticketType.findMany({
      where: { eventId, organizationId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map((r) => this.toEntity(r));
  }

  async update(input: UpdateTicketTypeInput): Promise<TicketType> {
    return this.prisma.$transaction(async (tx) => {
      const lockedEvents = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status
        FROM events
        WHERE id = ${input.eventId}::uuid
          AND organization_id = ${input.organizationId}::uuid
        FOR UPDATE
      `;
      const lockedEvent = lockedEvents[0];
      if (!lockedEvent) throw new EventNotFoundError();
      if (lockedEvent.status !== 'DRAFT') throw new EventNotInDraftError();

      const updateData: Record<string, unknown> = { version: { increment: 1 } };
      if (input.name !== undefined) updateData['name'] = input.name;
      if (input.description !== undefined) updateData['description'] = input.description;
      if (input.priceAmount !== undefined) updateData['priceAmount'] = input.priceAmount;
      if (input.capacity !== undefined) updateData['capacity'] = input.capacity;
      if (input.status !== undefined) updateData['status'] = input.status;

      const result = await tx.ticketType.updateMany({
        where: {
          id: input.ticketTypeId,
          eventId: input.eventId,
          organizationId: input.organizationId,
          version: input.expectedVersion,
        },
        data: updateData,
      });

      if (result.count === 0) throw new TicketTypeVersionConflictError();

      const updated = await tx.ticketType.findFirst({ where: { id: input.ticketTypeId } });
      if (!updated) throw new TicketTypeNotFoundError();

      const changedFields = Object.keys(updateData).filter((k) => k !== 'version');
      const isDeactivation = input.status === 'INACTIVE';

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'ticket-type',
          aggregateId: input.ticketTypeId,
          type: isDeactivation ? 'ticket-type.deactivated.v1' : 'ticket-type.updated.v1',
          version: '1',
          organizationId: input.organizationId,
          payload: {
            ticketTypeId: input.ticketTypeId,
            eventId: input.eventId,
            organizationId: input.organizationId,
            version: updated.version,
            changedFields,
            occurredAt: new Date().toISOString(),
          },
        },
      });

      return this.toEntity(updated);
    });
  }

  async countActiveByEvent(eventId: string): Promise<number> {
    return this.prisma.ticketType.count({
      where: { eventId, status: 'ACTIVE' },
    });
  }

  private toEntity(row: PrismaTicketType): TicketType {
    return new TicketType(
      row.id,
      row.eventId,
      row.organizationId,
      row.name,
      row.description,
      row.priceAmount,
      row.capacity,
      row.status,
      row.version,
      row.createdAt,
      row.updatedAt,
    );
  }
}
