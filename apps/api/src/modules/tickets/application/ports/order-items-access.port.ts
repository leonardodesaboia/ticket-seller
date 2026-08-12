export interface OrderItemForIssuance {
  id: string;
  ticketTypeId: string;
  quantity: number;
}

export interface OrderForIssuance {
  id: string;
  organizationId: string;
  eventId: string;
  status: string;
  items: OrderItemForIssuance[];
}

export interface IOrderItemsAccessPort {
  findOrderWithItems(orderId: string): Promise<OrderForIssuance | null>;
}

export const ORDER_ITEMS_ACCESS_PORT = Symbol('ORDER_ITEMS_ACCESS_PORT');
