import { API_BASE_URL } from './api-client';
import { PublicApiError } from './public-reservations.api';

export interface TransferResponse {
  claimToken: string;
  expiresAt: string;
}

export interface AcceptTransferResponse {
  newCredentialToken: string;
}

async function toError(response: Response): Promise<PublicApiError> {
  const body = await response.json().catch(() => null) as { code?: unknown } | null;
  return new PublicApiError(response.status, typeof body?.code === 'string' ? body.code : undefined);
}

export async function initiateTransfer(
  orderId: string,
  ticketId: string,
  token: string,
): Promise<TransferResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/public/orders/${encodeURIComponent(orderId)}/tickets/${encodeURIComponent(ticketId)}/transfer`,
    {
      method: 'POST',
      headers: {
        'X-Reservation-Token': token,
      },
    },
  );
  if (!response.ok) throw await toError(response);
  return response.json() as Promise<TransferResponse>;
}

export async function cancelTransfer(
  orderId: string,
  ticketId: string,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/public/orders/${encodeURIComponent(orderId)}/tickets/${encodeURIComponent(ticketId)}/transfer`,
    {
      method: 'DELETE',
      headers: {
        'X-Reservation-Token': token,
      },
    },
  );
  if (!response.ok) throw await toError(response);
}

export async function acceptTransfer(
  claimToken: string,
  idempotencyKey: string,
): Promise<AcceptTransferResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/public/transfers/${encodeURIComponent(claimToken)}/accept`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw await toError(response);
  return response.json() as Promise<AcceptTransferResponse>;
}
