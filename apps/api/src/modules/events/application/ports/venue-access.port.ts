export interface VenueInfo {
  id: string;
  organizationId: string;
}

export interface IVenueAccessPort {
  findVenue(venueId: string): Promise<VenueInfo | null>;
}

export const VENUE_ACCESS_PORT = Symbol('VENUE_ACCESS_PORT');
