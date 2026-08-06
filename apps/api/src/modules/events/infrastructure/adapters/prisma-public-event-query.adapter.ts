import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IPublicEventQueryPort,
  ListPublishedEventsInput,
  PublicEventDetail,
  PublicEventListResult,
} from '../../application/ports/public-event-query.port';
import { encodePublicCursor } from '../../domain/publication/public-cursor';

@Injectable()
export class PrismaPublicEventQueryAdapter implements IPublicEventQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(input: ListPublishedEventsInput): Promise<PublicEventListResult> {
    const now = new Date();
    const keyset = input.cursor
      ? {
          OR: [
            { startsAt: { gt: input.cursor.startsAt } },
            { startsAt: input.cursor.startsAt, id: { gt: input.cursor.id } },
          ],
        }
      : {};

    const rows = await this.prisma.event.findMany({
      // `slug`/`startsAt` are non-null for any PUBLISHED event (enforced by the
      // publication readiness policy). Pinning them here guarantees the keyset
      // total order and keeps the listing free of unusable (null-slug) items.
      where: {
        status: 'PUBLISHED',
        slug: { not: null },
        startsAt: { not: null },
        endsAt: { gte: now },
        ...keyset,
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      select: {
        id: true,
        slug: true,
        title: true,
        format: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        currency: true,
      },
    });

    const hasNext = rows.length > input.limit;
    const items = hasNext ? rows.slice(0, input.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasNext && last && last.startsAt
        ? encodePublicCursor({ startsAt: last.startsAt, id: last.id })
        : null;

    return {
      events: items.map((row) => ({
        id: row.id,
        slug: row.slug ?? '',
        title: row.title,
        format: row.format,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        timezone: row.timezone,
        currency: row.currency,
      })),
      nextCursor,
    };
  }

  async findPublishedBySlug(slug: string): Promise<PublicEventDetail | null> {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        slug: true,
        title: true,
        description: true,
        format: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        currency: true,
        venue: { select: { name: true, city: true, state: true, country: true } },
        ticketTypes: {
          where: { status: 'ACTIVE' },
          select: { name: true, description: true, priceAmount: true },
          // Cheapest first, then by name — a stable, meaningful public order
          // (ticket type ids are random UUIDs and must not drive presentation).
          orderBy: [{ priceAmount: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!event || event.slug === null) return null;

    return {
      slug: event.slug,
      title: event.title,
      description: event.description,
      format: event.format,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      currency: event.currency,
      venue: event.venue,
      ticketTypes: event.ticketTypes.map((ticketType) => ({
        name: ticketType.name,
        description: ticketType.description,
        priceAmount: ticketType.priceAmount,
        currency: event.currency,
      })),
    };
  }
}
