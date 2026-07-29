export interface Venue {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVenueInput {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}
