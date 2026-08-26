import { API_BASE_URL } from '@/shared/api/api-client';
import type { CreateVenueInput, Venue } from '../types';

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

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function createVenue(
  organizationId: string,
  input: CreateVenueInput,
  token: string,
): Promise<Venue> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/venues`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao criar local'), body);
  }

  return body as Venue;
}

export async function listVenues(organizationId: string, token: string): Promise<Venue[]> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/venues`, {
    headers: authHeaders(token),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao listar locais'), body);
  }

  return body as Venue[];
}
