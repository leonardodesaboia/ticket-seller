import { Venue } from '../venue.entity';

export interface CreateVenueInput {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

export interface IVenueRepository {
  create(input: CreateVenueInput): Promise<Venue>;
  findByOrganization(organizationId: string): Promise<Venue[]>;
}

export const VENUE_REPOSITORY = Symbol('VENUE_REPOSITORY');
