export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'TICKETS_ISSUED' | 'CANCELLED' | 'EXPIRED';

export interface Order {
  id: string;
  organizationId: string;
  eventId: string;
  reservationId: string;
  status: OrderStatus;
  currency: string;
  subtotalAmount: number;
  totalAmount: number;
  expiresAt: string;
}
