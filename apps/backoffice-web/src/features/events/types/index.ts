export interface Event {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string | undefined;
}
