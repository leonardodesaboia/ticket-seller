import { API_BASE_URL } from '@/shared/api/api-client';
import type { CreateEventInput, Event, ListEventsResponse, UpdateEventInput } from '../types';

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

export async function createEvent(
  organizationId: string,
  input: CreateEventInput,
  devUserId: string,
): Promise<Event> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-User-Id': devUserId,
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao criar evento'), body);
  }

  return body as Event;
}

export async function getEvent(
  organizationId: string,
  eventId: string,
  devUserId: string,
): Promise<Event> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/events/${eventId}`, {
    headers: { 'X-Dev-User-Id': devUserId },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Evento não encontrado'), body);
  }

  return body as Event;
}

export async function listEvents(
  organizationId: string,
  params: { cursor?: string; limit?: number },
  devUserId: string,
): Promise<ListEventsResponse> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';

  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/events${query}`, {
    headers: { 'X-Dev-User-Id': devUserId },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao listar eventos'), body);
  }

  return body as ListEventsResponse;
}

export async function updateEvent(
  organizationId: string,
  eventId: string,
  input: UpdateEventInput,
  devUserId: string,
): Promise<Event> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-User-Id': devUserId,
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao atualizar evento'), body);
  }

  return body as Event;
}
