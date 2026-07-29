import type { Event } from '../event.entity';

export interface CreateEventInput {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
}

export interface IEventRepository {
  create(input: CreateEventInput): Promise<Event>;
  findByOrganizationAndId(organizationId: string, eventId: string): Promise<Event | null>;
}

export const EVENT_REPOSITORY = Symbol('EVENT_REPOSITORY');
