import { Ticket } from '../ticket.entity';

export interface CreateTicketData {
  id: string;
  organizationId: string;
  eventId: string;
  orderId: string;
  orderItemId: string;
  ticketTypeId: string;
  unitIndex: number;
  publicCode: string;
}

export interface ITicketRepository {
  createIfNotExists(data: CreateTicketData): Promise<Ticket | null>;
  findByOrderId(orderId: string, organizationId: string): Promise<Ticket[]>;
}

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');
