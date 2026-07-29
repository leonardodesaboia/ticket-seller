import type { Event } from '../event.entity';

export interface CreateEventInput {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
}

export interface UpdateEventInput {
  organizationId: string;
  eventId: string;
  expectedVersion: number;
  title?: string;
  description?: string | null;
}

export interface ListEventsInput {
  organizationId: string;
  cursor?: string;
  limit: number;
}

export interface ListEventsResult {
  events: Event[];
  nextCursor: string | null;
}

export interface IEventRepository {
  create(input: CreateEventInput): Promise<Event>;
  findByOrganizationAndId(organizationId: string, eventId: string): Promise<Event | null>;
  findByOrganization(input: ListEventsInput): Promise<ListEventsResult>;
  update(input: UpdateEventInput): Promise<Event>;
}

export const EVENT_REPOSITORY = Symbol('EVENT_REPOSITORY');
