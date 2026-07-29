export interface Event {
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
  createdAt: string;
  updatedAt?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string | undefined;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  version: number;
}

export interface UpdateEventConfigurationInput {
  expectedVersion: number;
  format?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  onlineInfo?: string | null;
  venueId?: string | null;
  currency?: string;
}

export interface ListEventsResponse {
  data: Event[];
  nextCursor: string | null;
}
