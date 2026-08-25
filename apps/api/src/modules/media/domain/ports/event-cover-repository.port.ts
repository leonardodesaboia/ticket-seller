export const EVENT_COVER_REPOSITORY = Symbol('EVENT_COVER_REPOSITORY');

export interface EventCoverRecord {
  coverImageKey: string | null;
}

export interface IEventCoverRepository {
  existsInOrganization(eventId: string, organizationId: string): Promise<boolean>;
  findByOrganization(eventId: string, organizationId: string): Promise<EventCoverRecord | null>;
  updateCoverKey(eventId: string, organizationId: string, key: string): Promise<void>;
}
