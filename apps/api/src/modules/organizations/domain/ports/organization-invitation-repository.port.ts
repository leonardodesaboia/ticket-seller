import type { OrganizationInvitation } from '../entities/organization-invitation.entity';

export interface CreateInvitationInput {
  id: string;
  organizationId: string;
  inviterId: string;
  email: string;
  role: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface OrganizationMemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: Date | null;
  user: {
    email: string;
    displayName: string | null;
  };
}

export interface IOrganizationInvitationRepository {
  createInvitation(input: CreateInvitationInput): Promise<OrganizationInvitation>;
  findInvitationByTokenHash(tokenHash: string): Promise<OrganizationInvitation | null>;
  findInvitationById(id: string, organizationId: string): Promise<OrganizationInvitation | null>;
  markInvitationUsed(id: string, userId: string): Promise<void>;
  revokeInvitation(id: string): Promise<void>;

  isActiveMember(organizationId: string, email: string): Promise<boolean>;
  findActiveMemberByUserId(organizationId: string, userId: string): Promise<{ role: string; id: string } | null>;
  findMemberById(organizationId: string, memberId: string): Promise<OrganizationMemberRecord | null>;
  listActiveMembers(organizationId: string): Promise<OrganizationMemberRecord[]>;
  countActiveOwners(organizationId: string): Promise<number>;
  updateMemberRole(memberId: string, role: string): Promise<void>;
  removeMember(memberId: string): Promise<void>;

  /**
   * Atomically checks OWNER protection and updates the member's role within a single DB
   * transaction, preventing TOCTOU races where two OWNERs could be demoted concurrently.
   *
   * Throws MemberNotFoundError  – member does not exist or is not ACTIVE.
   * Throws LastOwnerProtectionError – demoting the last active OWNER.
   */
  updateMemberRoleAtomically(memberId: string, organizationId: string, newRole: string): Promise<void>;

  /**
   * Atomically checks OWNER protection and soft-deletes the member within a single DB
   * transaction, preventing TOCTOU races where two OWNERs could be removed concurrently.
   *
   * Throws MemberNotFoundError  – member does not exist or is not ACTIVE.
   * Throws LastOwnerProtectionError – removing the last active OWNER.
   */
  removeMemberAtomically(memberId: string, organizationId: string): Promise<void>;

  findUserEmailById(userId: string): Promise<string | null>;
}

export const ORGANIZATION_INVITATION_REPOSITORY = Symbol('ORGANIZATION_INVITATION_REPOSITORY');
