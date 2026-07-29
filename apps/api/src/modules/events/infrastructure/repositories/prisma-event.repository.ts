import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { Event } from '../../domain/event.entity';
import type { CreateEventInput, IEventRepository } from '../../domain/ports/event-repository.port';

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

  private toEntity(row: {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Event {
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
