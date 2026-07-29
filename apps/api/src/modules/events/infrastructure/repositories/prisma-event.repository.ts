import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { Event } from '../../domain/event.entity';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVersionConflictError,
} from '../../domain/event.errors';
import { EventCurrencyLockedError } from '../../domain/ticket-types/ticket-type.errors';
import type {
  CreateEventInput,
  IEventRepository,
  ListEventsInput,
  ListEventsResult,
  UpdateEventConfigurationInput,
  UpdateEventInput,
} from '../../domain/ports/event-repository.port';
import type { Event as PrismaEvent } from '@prisma/client';

const ISO_DATE_LENGTH = 24; // "2026-07-29T04:35:16.154Z" is always 24 chars

function encodeCursor(event: { createdAt: Date; id: string }): string {
  return Buffer.from(`${event.createdAt.toISOString()}|${event.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
  return {
    createdAt: new Date(decoded.substring(0, ISO_DATE_LENGTH)),
    id: decoded.substring(ISO_DATE_LENGTH + 1),
  };
}

@Injectable()
export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEventInput): Promise<Event> {
    const [row] = await this.prisma.$transaction([
      this.prisma.event.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          title: input.title,
          description: input.description,
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          aggregateType: 'event',
          aggregateId: input.id,
          type: 'event.created.v1',
          version: '1',
          organizationId: input.organizationId,
          payload: {
            eventId: input.id,
            organizationId: input.organizationId,
            title: input.title,
          },
        },
      }),
    ]);

    return this.toEntity(row);
  }

  async findByOrganizationAndId(organizationId: string, eventId: string): Promise<Event | null> {
    const row = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!row) return null;

    return this.toEntity(row);
  }

  async findByOrganization(input: ListEventsInput): Promise<ListEventsResult> {
    const limit = input.limit;

    let whereClause: Parameters<typeof this.prisma.event.findMany>[0] extends
      { where?: infer W } | undefined
      ? W
      : never = { organizationId: input.organizationId };

    if (input.cursor) {
      const { createdAt, id } = decodeCursor(input.cursor);
      whereClause = {
        organizationId: input.organizationId,
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt: { equals: createdAt }, id: { lt: id } },
        ],
      };
    }

    const rows = await this.prisma.event.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor = hasNext && lastItem ? encodeCursor(lastItem) : null;

    return {
      events: items.map((row) => this.toEntity(row)),
      nextCursor,
    };
  }

  async update(input: UpdateEventInput): Promise<Event> {
    return this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        version: { increment: 1 },
      };
      if (input.title !== undefined) updateData['title'] = input.title;
      if (input.description !== undefined) updateData['description'] = input.description;

      const result = await tx.event.updateMany({
        where: {
          id: input.eventId,
          organizationId: input.organizationId,
          version: input.expectedVersion,
          status: 'DRAFT',
        },
        data: updateData,
      });

      if (result.count === 0) {
        throw new EventVersionConflictError();
      }

      const updated = await tx.event.findFirst({
        where: { id: input.eventId, organizationId: input.organizationId },
      });
      if (!updated) throw new EventNotFoundError();

      const changedFields: string[] = [];
      if (input.title !== undefined) changedFields.push('title');
      if (input.description !== undefined) changedFields.push('description');

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'event',
          aggregateId: input.eventId,
          type: 'event.updated.v1',
          version: '1',
          organizationId: input.organizationId,
          payload: {
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

  async updateConfiguration(input: UpdateEventConfigurationInput): Promise<Event> {
    return this.prisma.$transaction(async (tx) => {
      const lockedEvents = await tx.$queryRaw<
        Array<{ status: string; version: number; currency: string | null }>
      >`
        SELECT status, version, currency
        FROM events
        WHERE id = ${input.eventId}::uuid
          AND organization_id = ${input.organizationId}::uuid
        FOR UPDATE
      `;
      const lockedEvent = lockedEvents[0];
      if (!lockedEvent) throw new EventNotFoundError();
      if (lockedEvent.status !== 'DRAFT') throw new EventNotInDraftError();
      if (lockedEvent.version !== input.expectedVersion) throw new EventVersionConflictError();

      if (input.currency !== undefined && input.currency !== lockedEvent.currency) {
        const activeTicketTypes = await tx.ticketType.count({
          where: {
            eventId: input.eventId,
            organizationId: input.organizationId,
            status: 'ACTIVE',
          },
        });
        if (activeTicketTypes > 0) throw new EventCurrencyLockedError();
      }

      const updateData: Record<string, unknown> = {
        version: { increment: 1 },
      };
      if (input.format !== undefined) updateData['format'] = input.format;
      if (input.startsAt !== undefined) updateData['startsAt'] = input.startsAt;
      if (input.endsAt !== undefined) updateData['endsAt'] = input.endsAt;
      if (input.timezone !== undefined) updateData['timezone'] = input.timezone;
      if (input.onlineInfo !== undefined) updateData['onlineInfo'] = input.onlineInfo;
      if (input.venueId !== undefined) updateData['venueId'] = input.venueId;
      if (input.currency !== undefined) updateData['currency'] = input.currency;

      const result = await tx.event.updateMany({
        where: {
          id: input.eventId,
          organizationId: input.organizationId,
          version: input.expectedVersion,
          status: 'DRAFT',
        },
        data: updateData,
      });

      if (result.count === 0) {
        throw new EventVersionConflictError();
      }

      const updated = await tx.event.findFirst({
        where: { id: input.eventId, organizationId: input.organizationId },
      });
      if (!updated) throw new EventNotFoundError();

      const changedFields = Object.keys(updateData).filter((k) => k !== 'version');

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'event',
          aggregateId: input.eventId,
          type: 'event.configuration-updated.v1',
          version: '1',
          organizationId: input.organizationId,
          payload: {
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

  private toEntity(row: PrismaEvent): Event {
    return new Event(
      row.id,
      row.organizationId,
      row.title,
      row.description,
      row.status,
      row.version,
      row.format,
      row.startsAt,
      row.endsAt,
      row.timezone,
      row.onlineInfo,
      row.venueId,
      row.currency,
      row.createdAt,
      row.updatedAt,
    );
  }
}
