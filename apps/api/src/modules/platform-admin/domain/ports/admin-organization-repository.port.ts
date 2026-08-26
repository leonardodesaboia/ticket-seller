export const ADMIN_ORGANIZATION_REPOSITORY = 'ADMIN_ORGANIZATION_REPOSITORY';

export interface AdminOrganizationListItem {
  id: string;
  name: string;
  suspendedAt: Date | null;
  createdAt: Date;
  memberCount: number;
  eventCount: number;
}

export interface AdminOrganizationSuspendTarget {
  id: string;
  suspendedAt: Date | null;
}

export interface IAdminOrganizationRepository {
  findById(id: string): Promise<AdminOrganizationSuspendTarget | null>;
  findAll(params: {
    cursor: { id: string; createdAt: Date } | null;
    take: number;
  }): Promise<AdminOrganizationListItem[]>;
  suspend(id: string): Promise<void>;
  unsuspend(id: string): Promise<void>;
  /** Revokes all active sessions for every active member of the organization. */
  revokeMemberSessions(organizationId: string): Promise<void>;
}
