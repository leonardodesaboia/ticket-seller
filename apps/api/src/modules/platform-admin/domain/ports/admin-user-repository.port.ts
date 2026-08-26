export const ADMIN_USER_REPOSITORY = 'ADMIN_USER_REPOSITORY';

export interface AdminUserListItem {
  id: string;
  displayName: string | null;
  suspendedAt: Date | null;
  createdAt: Date;
}

export interface AdminUserSuspendTarget {
  id: string;
  platformRole: string | null;
  suspendedAt: Date | null;
}

export interface IAdminUserRepository {
  findById(id: string): Promise<AdminUserSuspendTarget | null>;
  findAll(params: {
    cursor: { id: string; createdAt: Date } | null;
    take: number;
  }): Promise<AdminUserListItem[]>;
  suspend(id: string): Promise<void>;
  unsuspend(id: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
}
