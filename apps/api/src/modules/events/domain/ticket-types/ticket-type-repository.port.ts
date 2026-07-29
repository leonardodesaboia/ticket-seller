import type { TicketType } from './ticket-type.entity';

export interface CreateTicketTypeInput {
  id: string;
  eventId: string;
  organizationId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  capacity: number;
}

export interface UpdateTicketTypeInput {
  ticketTypeId: string;
  eventId: string;
  organizationId: string;
  expectedVersion: number;
  name?: string;
  description?: string | null;
  priceAmount?: number;
  capacity?: number;
  status?: string;
}

export interface ITicketTypeRepository {
  create(input: CreateTicketTypeInput): Promise<TicketType>;
  findByEventAndId(eventId: string, ticketTypeId: string): Promise<TicketType | null>;
  findByEvent(eventId: string, organizationId: string): Promise<TicketType[]>;
  update(input: UpdateTicketTypeInput): Promise<TicketType>;
  countActiveByEvent(eventId: string): Promise<number>;
}

export const TICKET_TYPE_REPOSITORY = Symbol('TICKET_TYPE_REPOSITORY');
