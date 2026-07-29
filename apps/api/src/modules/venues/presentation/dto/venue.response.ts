import type { Venue } from '../../domain/venue.entity';

export class VenueResponse {
  id!: string;
  organizationId!: string;
  name!: string;
  address!: string;
  city!: string;
  state!: string;
  country!: string;
  postalCode!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static from(venue: Venue): VenueResponse {
    const res = new VenueResponse();
    res.id = venue.id;
    res.organizationId = venue.organizationId;
    res.name = venue.name;
    res.address = venue.address;
    res.city = venue.city;
    res.state = venue.state;
    res.country = venue.country;
    res.postalCode = venue.postalCode;
    res.createdAt = venue.createdAt.toISOString();
    res.updatedAt = venue.updatedAt.toISOString();
    return res;
  }
}
