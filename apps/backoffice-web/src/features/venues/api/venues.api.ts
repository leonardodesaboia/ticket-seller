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

export async function createVenue(
  organizationId: string,
  input: CreateVenueInput,
  devUserId: string,
): Promise<Venue> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/venues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-User-Id': devUserId,
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao criar local'), body);
  }

  return body as Venue;
}

export async function listVenues(organizationId: string, devUserId: string): Promise<Venue[]> {
  const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/venues`, {
    headers: { 'X-Dev-User-Id': devUserId },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body, 'Erro ao listar locais'), body);
  }

  return body as Venue[];
}
