import type { TicketType } from '../../domain/ticket-types/ticket-type.entity';

export interface CreateTicketTypeOperationTicket {
  id: string;
  eventId: string;
  organizationId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  capacity: number;
}

export interface CreateTicketTypeOperationInput {
  scopedKey: string;
  requestHash: string;
  expiresAt: Date;
  ticketType: CreateTicketTypeOperationTicket;
}

export interface CreateTicketTypeOperationResult {
  ticketType: TicketType;
  cached: boolean;
}

export interface ICreateTicketTypeOperationPort {
  execute(input: CreateTicketTypeOperationInput): Promise<CreateTicketTypeOperationResult>;
}

export const CREATE_TICKET_TYPE_OPERATION_PORT = Symbol('CREATE_TICKET_TYPE_OPERATION_PORT');
