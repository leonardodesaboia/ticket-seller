import type { OrderView } from '../../domain/ports/order-repository.port';

export class OrderItemResponse {
  ticketTypeId!: string;
  name!: string;
  quantity!: number;
  unitPriceAmount!: number;
  subtotalAmount!: number;
}

export class OrderResponse {
  orderId!: string;
  reservationId!: string;
  status!: string;
  currency!: string;
  subtotalAmount!: number;
  totalAmount!: number;
  expiresAt!: string;
  items!: OrderItemResponse[];

  static from(view: OrderView): OrderResponse {
    return { ...view, items: view.items.map((item) => ({ ...item })) };
  }
}
