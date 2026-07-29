import type { Organization } from '../organization.entity';

export interface CreateOrganizationInput {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface IOrganizationRepository {
  create(input: CreateOrganizationInput): Promise<Organization>;
  existsBySlug(slug: string): Promise<boolean>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');
