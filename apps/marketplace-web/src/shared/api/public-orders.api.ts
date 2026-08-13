import { API_BASE_URL } from './api-client';
import { PublicApiError } from './public-reservations.api';

export interface PublicOrder {
  orderId: string;
  reservationId: string;
  status: string;
  currency: string;
  subtotalAmount: number;
  totalAmount: number;
  expiresAt: string;
  items: Array<{ ticketTypeId: string; name: string; quantity: number; unitPriceAmount: number; subtotalAmount: number }>;
}

export async function createPublicOrder(input: { reservationId: string; token: string; idempotencyKey: string }): Promise<PublicOrder> {
  const response = await fetch(`${API_BASE_URL}/public/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reservation-Token': input.token, 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({ reservationId: input.reservationId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { code?: unknown } | null;
    throw new PublicApiError(response.status, typeof body?.code === 'string' ? body.code : undefined);
  }
  return response.json() as Promise<PublicOrder>;
}
