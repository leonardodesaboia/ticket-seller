import type { PublicEventCursor } from '../../domain/publication/public-cursor';

export interface PublicEventListRow {
  id: string;
  slug: string;
  title: string;
  format: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string | null;
  currency: string | null;
}

export interface PublicEventListResult {
  events: PublicEventListRow[];
  nextCursor: string | null;
}

export interface PublicEventDetail {
  slug: string;
  organizationId: string;
  title: string;
  description: string | null;
  format: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string | null;
  currency: string | null;
  venue: {
    name: string;
    city: string;
    state: string;
    country: string;
  } | null;
  ticketTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    priceAmount: number;
    currency: string | null;
  }>;
}

export interface ListPublishedEventsInput {
  limit: number;
  cursor?: PublicEventCursor;
}

export interface IPublicEventQueryPort {
  listPublished(input: ListPublishedEventsInput): Promise<PublicEventListResult>;
  findPublishedBySlug(slug: string): Promise<PublicEventDetail | null>;
}

export const PUBLIC_EVENT_QUERY_PORT = Symbol('PUBLIC_EVENT_QUERY_PORT');
