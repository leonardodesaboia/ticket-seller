import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  EventCoverRecord,
  IEventCoverRepository,
} from '../../domain/ports/event-cover-repository.port';

@Injectable()
export class PrismaEventCoverRepository implements IEventCoverRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsInOrganization(eventId: string, organizationId: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
    return event !== null;
  }

  async findByOrganization(
    eventId: string,
    organizationId: string,
  ): Promise<EventCoverRecord | null> {
    return this.prisma.event.findUnique({
      where: { id: eventId, organizationId },
      select: { coverImageKey: true },
    });
  }

  async updateCoverKey(eventId: string, organizationId: string, key: string): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId, organizationId },
      data: { coverImageKey: key },
    });
  }
}
