import { API_BASE_URL } from './api-client';

export interface PublicAvailabilityItem {
  ticketTypeId: string;
  availableQuantity: number;
}

export interface PublicAvailabilityResponse {
  eventSlug: string;
  items: PublicAvailabilityItem[];
}

export async function getPublicAvailability(eventSlug: string): Promise<PublicAvailabilityResponse> {
  const response = await fetch(`${API_BASE_URL}/public/events/${encodeURIComponent(eventSlug)}/availability`);
  if (!response.ok) throw new Error(`Failed to load availability (${response.status})`);
  return response.json() as Promise<PublicAvailabilityResponse>;
}
