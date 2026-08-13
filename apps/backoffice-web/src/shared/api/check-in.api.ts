import { API_BASE_URL } from './api-client';

export type AdmissionDecision =
  | 'ADMITTED'
  | 'ALREADY_CHECKED_IN'
  | 'INVALID_CREDENTIAL'
  | 'TICKET_CANCELLED'
  | 'EVENT_NOT_ACTIVE'
  | 'WRONG_EVENT'
  | 'TRANSFER_PENDING';

export interface CheckInResponse {
  decision: AdmissionDecision;
  allowed: boolean;
  checkedInAt: string | null;
}

export interface CheckInInput {
  credential: string;
  notes?: string;
}

export class CheckInApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'CheckInApiError';
  }
}

function extractDetail(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    return String((body as { detail: unknown }).detail);
  }
  return fallback;
}

export async function performCheckIn(
  organizationId: string,
  eventId: string,
  input: CheckInInput,
  devUserId: string,
  idempotencyKey: string,
): Promise<CheckInResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/organizations/${organizationId}/events/${eventId}/check-ins`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-User-Id': devUserId,
        'Idempotency-Key': idempotencyKey,
      },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify(input),
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CheckInApiError(res.status, extractDetail(body, 'Erro ao realizar check-in'), body);
  }

  return body as CheckInResponse;
}
