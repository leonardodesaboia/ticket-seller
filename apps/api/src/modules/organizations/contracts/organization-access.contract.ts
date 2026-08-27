export interface OrganizationMemberInfo {
  role: string;
  status: string;
}

export interface IOrganizationAccessPort {
  findMember(organizationId: string, userId: string): Promise<OrganizationMemberInfo | null>;
}

export const ORGANIZATION_ACCESS_PORT = Symbol('ORGANIZATION_ACCESS_PORT');

export const EVENT_CREATOR_ROLES = ['OWNER', 'ADMIN', 'EVENT_MANAGER'] as const;
