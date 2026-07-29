import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { IPublicationReadinessQueryPort } from '../../application/ports/publication-readiness-query.port';
import type { PublicationReadinessSnapshot } from '../../domain/publication/publication-readiness.policy';

@Injectable()
export class PrismaPublicationReadinessQueryAdapter implements IPublicationReadinessQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findSnapshot(
    organizationId: string,
    eventId: string,
  ): Promise<PublicationReadinessSnapshot | null> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
        version: true,
        format: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        onlineInfo: true,
        venueId: true,
        currency: true,
        organization: { select: { status: true } },
        venue: { select: { id: true, organizationId: true } },
        ticketTypes: {
          select: {
            id: true,
            name: true,
            priceAmount: true,
            capacity: true,
            status: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!event) return null;

    return {
      organizationStatus: event.organization.status,
      event: {
        id: event.id,
        organizationId: event.organizationId,
        title: event.title,
        status: event.status,
        version: event.version,
        format: event.format,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        onlineConfigured:
          event.onlineInfo !== null && event.onlineInfo.trim().length > 0,
        venueId: event.venueId,
        currency: event.currency,
      },
      venue: event.venue,
      ticketTypes: event.ticketTypes,
    };
  }
}
