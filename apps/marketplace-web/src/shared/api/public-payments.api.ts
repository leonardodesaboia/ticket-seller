import { API_BASE_URL } from './api-client';
import { PublicApiError } from './public-reservations.api';

export type PaymentMethod = 'FAKE_PIX' | 'FAKE_CREDIT_CARD';
export type AttemptStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface CheckoutData {
  type: 'PIX' | 'CREDIT_CARD';
  qrCode?: string;
  qrCodeText?: string;
  clientToken?: string;
}

export interface PaymentAttemptResponse {
  paymentAttemptId: string;
  orderId: string;
  provider: string;
  status: AttemptStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  expiresAt: string;
  checkoutData: CheckoutData | null;
}

export interface TicketItem {
  ticketId: string;
  ticketTypeId: string;
  orderItemId: string;
  unitIndex: number;
  publicCode: string;
  status: string;
}

export interface TicketsResponse {
  orderId: string;
  tickets: TicketItem[];
}

async function toPaymentError(response: Response): Promise<PublicApiError> {
  const body = await response.json().catch(() => null) as { code?: unknown } | null;
  return new PublicApiError(response.status, typeof body?.code === 'string' ? body.code : undefined);
}

export async function createPaymentAttempt(
  orderId: string,
  token: string,
  idempotencyKey: string,
  method: PaymentMethod,
): Promise<PaymentAttemptResponse> {
  const response = await fetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Reservation-Token': token,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ paymentMethod: method }),
  });
  if (!response.ok) throw await toPaymentError(response);
  return response.json() as Promise<PaymentAttemptResponse>;
}

export async function getLatestPaymentAttempt(
  orderId: string,
  token: string,
): Promise<PaymentAttemptResponse | null> {
  const response = await fetch(
    `${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/payments/latest`,
    { headers: { 'X-Reservation-Token': token } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw await toPaymentError(response);
  return response.json() as Promise<PaymentAttemptResponse>;
}

export async function getOrderTickets(
  orderId: string,
  token: string,
): Promise<TicketsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/tickets`,
    { headers: { 'X-Reservation-Token': token } },
  );
  if (!response.ok) throw await toPaymentError(response);
  return response.json() as Promise<TicketsResponse>;
}
