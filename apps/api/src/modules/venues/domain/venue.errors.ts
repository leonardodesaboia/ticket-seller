export class VenueNotFoundError extends Error {
  constructor(venueId: string) {
    super(`Venue not found: ${venueId}`);
    this.name = 'VenueNotFoundError';
  }
}
