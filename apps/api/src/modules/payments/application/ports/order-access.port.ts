export interface OrderForPayment {
  id: string;
  organizationId: string;
  reservationId: string;
  continuationTokenHash: string;
  status: string;
  currency: string;
  totalAmount: bigint;
  expiresAt: Date;
}

export interface IOrderAccessPort {
  findOrderWithToken(orderId: string, tokenHash: string): Promise<OrderForPayment | null>;
}

export const ORDER_ACCESS_PORT = Symbol('ORDER_ACCESS_PORT');
