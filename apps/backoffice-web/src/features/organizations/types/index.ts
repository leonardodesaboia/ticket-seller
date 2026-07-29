export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}
