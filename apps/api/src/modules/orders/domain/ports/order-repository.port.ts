import type { OrderStatus } from '../order.entity';

export interface OrderViewItem {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceAmount: number;
  subtotalAmount: number;
}

export interface OrderView {
  orderId: string;
  reservationId: string;
  status: OrderStatus;
  currency: string;
  subtotalAmount: number;
  totalAmount: number;
  expiresAt: string;
  items: OrderViewItem[];
}

export interface IOrderRepository {
  get(orderId: string, tokenHash: string): Promise<OrderView>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
