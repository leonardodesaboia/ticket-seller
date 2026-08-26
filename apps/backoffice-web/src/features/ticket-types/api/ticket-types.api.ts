import { API_BASE_URL } from '@/shared/api/api-client';
import type {
  CreateTicketTypeInput,
  ListTicketTypesResponse,
  TicketType,
  UpdateTicketTypeInput,
} from '../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractDetail(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    return String((body as { detail: unknown }).detail);
  }
  return fallback;
}

function authHeaders(token: string, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return headers;
}

export async function createTicketType(
  organizationId: string,
  eventId: string,
  input: CreateTicketTypeInput,
  idempotencyKey: string,
  token: string,
): Promise<TicketType> {
  const res = await fetch(
    `${API_BASE_URL}/organizations/${organizationId}/events/${eventId}/ticket-types`,
    {
      method: 'POST',
      headers: authHeaders(token, idempotencyKey),
      body: JSON.stringify(input),
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao criar tipo de ingresso'), body);
  }

  return body as TicketType;
}

export async function listTicketTypes(
  organizationId: string,
  eventId: string,
  token: string,
): Promise<ListTicketTypesResponse> {
  const res = await fetch(
    `${API_BASE_URL}/organizations/${organizationId}/events/${eventId}/ticket-types`,
    { headers: authHeaders(token) },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao listar tipos de ingresso'), body);
  }

  return body as ListTicketTypesResponse;
}

export async function updateTicketType(
  organizationId: string,
  eventId: string,
  ticketTypeId: string,
  input: UpdateTicketTypeInput,
  token: string,
): Promise<TicketType> {
  const res = await fetch(
    `${API_BASE_URL}/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao atualizar tipo de ingresso'), body);
  }

  return body as TicketType;
}
