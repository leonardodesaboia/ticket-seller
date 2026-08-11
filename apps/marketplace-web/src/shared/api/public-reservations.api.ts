import { API_BASE_URL } from './api-client';

export interface ReservationItem {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceAmount: number;
  subtotalAmount: number;
}

export interface PublicReservation {
  reservationId: string;
  token?: string;
  status: string;
  expiresAt: string;
  currency: string;
  subtotalAmount: number;
  items: ReservationItem[];
}

export class PublicApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(`API request failed (${status})`);
  }
}

async function toError(response: Response): Promise<PublicApiError> {
  const body = await response.json().catch(() => null) as { code?: unknown } | null;
  return new PublicApiError(response.status, typeof body?.code === 'string' ? body.code : undefined);
}

export async function createPublicReservation(input: {
  eventSlug: string;
  items: Array<{ ticketTypeId: string; quantity: number }>;
  idempotencyKey: string;
}): Promise<PublicReservation> {
  const response = await fetch(`${API_BASE_URL}/public/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({ eventSlug: input.eventSlug, items: input.items }),
  });
  if (!response.ok) throw await toError(response);
  return response.json() as Promise<PublicReservation>;
}

export async function getPublicReservation(reservationId: string, token: string): Promise<PublicReservation> {
  const response = await fetch(`${API_BASE_URL}/public/reservations/${encodeURIComponent(reservationId)}`, {
    headers: { 'X-Reservation-Token': token },
  });
  if (!response.ok) throw await toError(response);
  return response.json() as Promise<PublicReservation>;
}
