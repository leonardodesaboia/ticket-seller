import { API_BASE_URL } from './api-client';

export interface PublicEventListItem {
  slug: string;
  title: string;
  format: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  currency: string | null;
}

export interface PublicEventListResponse {
  data: PublicEventListItem[];
  nextCursor: string | null;
}

export interface PublicVenue {
  name: string;
  city: string;
  state: string;
  country: string;
}

export interface PublicTicketType {
  name: string;
  description: string | null;
  price: number;
  currency: string | null;
}

export interface PublicEventDetail {
  slug: string;
  title: string;
  description: string | null;
  format: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  currency: string | null;
  venue: PublicVenue | null;
  ticketTypes: PublicTicketType[];
}

// Align client-side revalidation with the public API's max-age=60.
const REVALIDATE_SECONDS = 60;

export async function listPublicEvents(
  params: { cursor?: string; limit?: number } = {},
): Promise<PublicEventListResponse> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';

  const response = await fetch(`${API_BASE_URL}/public/events${query}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`Failed to load events (${response.status})`);
  }
  return response.json() as Promise<PublicEventListResponse>;
}

/**
 * Fetches a published event by slug. Returns null for a 404 so callers can
 * render an indistinguishable not-found page without leaking whether the slug
 * exists administratively.
 */
export async function getPublicEvent(slug: string): Promise<PublicEventDetail | null> {
  const response = await fetch(`${API_BASE_URL}/public/events/${encodeURIComponent(slug)}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load event (${response.status})`);
  }
  return response.json() as Promise<PublicEventDetail>;
}
