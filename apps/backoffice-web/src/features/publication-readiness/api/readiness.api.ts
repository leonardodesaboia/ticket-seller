import { API_BASE_URL } from '@/shared/api/api-client';
import type { PublicationReadiness } from '../types';

function extractDetail(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    return String((body as { detail: unknown }).detail);
  }
  return fallback;
}

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function getPublicationReadiness(
  organizationId: string,
  eventId: string,
  token: string,
): Promise<PublicationReadiness> {
  const res = await fetch(
    `${API_BASE_URL}/organizations/${organizationId}/events/${eventId}/publication-readiness`,
    { headers: authHeaders(token) },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractDetail(body, 'Erro ao carregar o checklist de publicação'));
  }

  return body as PublicationReadiness;
}
