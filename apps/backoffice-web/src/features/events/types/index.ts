export interface Event {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
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

export interface ListEventsResponse {
  data: Event[];
  nextCursor: string | null;
}
