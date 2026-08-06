export interface PublishEventOperationInput {
  scopedKey: string;
  requestHash: string;
  expiresAt: Date;
  organizationId: string;
  eventId: string;
  actorId: string;
  expectedVersion: number;
  now: Date;
}

/**
 * Plain, transport-safe view of a published event. It deliberately excludes the
 * private `onlineInfo` (exposing only `onlineConfigured`) so it can be cached in
 * the idempotency record and replayed without leaking private data.
 */
export interface PublishedEventData {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  format: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  venueId: string | null;
  currency: string | null;
  onlineConfigured: boolean;
  slug: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishEventOperationResult {
  event: PublishedEventData;
  cached: boolean;
}

export interface IPublishEventOperationPort {
  execute(input: PublishEventOperationInput): Promise<PublishEventOperationResult>;
}

export const PUBLISH_EVENT_OPERATION_PORT = Symbol('PUBLISH_EVENT_OPERATION_PORT');
