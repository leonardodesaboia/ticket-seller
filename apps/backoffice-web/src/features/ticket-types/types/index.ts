export interface TicketType {
  id: string;
  eventId: string;
  organizationId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  capacity: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketTypeInput {
  name: string;
  priceAmount: number;
  capacity: number;
  description?: string | null;
}

export interface UpdateTicketTypeInput {
  expectedVersion: number;
  name?: string;
  description?: string | null;
  priceAmount?: number;
  capacity?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ListTicketTypesResponse {
  data: TicketType[];
}
