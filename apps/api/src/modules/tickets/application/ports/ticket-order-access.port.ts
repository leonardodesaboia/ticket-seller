export interface OrderForTicketAccess {
  id: string;
  organizationId: string;
  status: string;
}

export interface ITicketOrderAccessPort {
  findOrderWithToken(orderId: string, token: string): Promise<OrderForTicketAccess | null>;
}

export const TICKET_ORDER_ACCESS_PORT = Symbol('TICKET_ORDER_ACCESS_PORT');
