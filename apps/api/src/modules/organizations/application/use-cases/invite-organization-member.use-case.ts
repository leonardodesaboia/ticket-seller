import { createHash, randomUUID } from 'crypto';
import type { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';
import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import {
  VALID_ORGANIZATION_ROLES,
  ROLE_CAPABILITIES,
  OrganizationCapability,
} from '../../../../shared/kernel/organization-capability';
import { InsufficientRoleToAssignError } from '../../domain/organization.errors';
import type { ILogger } from '../../../../shared/kernel/logger.port';
const INVITATION_TTL_DAYS = 7;

export { InsufficientRoleToAssignError };

export interface InviteOrganizationMemberCommand {
  organizationId: string;
  inviterId: string;
  email: string;
  role: string;
}

export interface InviteOrganizationMemberResult {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  /** Raw token — only returned for dev/logging; never stored */
  rawToken: string;
}

export class InvalidRoleError extends Error {
  constructor(role: string) {
    super(`Invalid role: ${role}`);
    this.name = 'InvalidRoleError';
  }
}

export class InviteOrganizationMemberUseCase {
  constructor(
    private readonly repo: IOrganizationInvitationRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: InviteOrganizationMemberCommand): Promise<InviteOrganizationMemberResult> {
    const normalizedEmail = command.email.toLowerCase().trim();

    if (!VALID_ORGANIZATION_ROLES.includes(command.role)) {
      throw new InvalidRoleError(command.role);
    }

    // Only OWNER (has ROLES_ASSIGN capability) can invite as OWNER
    if (command.role === 'OWNER') {
      const inviterMember = await this.repo.findActiveMemberByUserId(
        command.organizationId,
        command.inviterId,
      );
      const inviterCapabilities = inviterMember ? (ROLE_CAPABILITIES[inviterMember.role] ?? []) : [];
      if (!inviterCapabilities.includes(OrganizationCapability.ROLES_ASSIGN)) {
        throw new InsufficientRoleToAssignError();
      }
    }

    // Security: do not reveal if email is already member — always respond 201
    // But we still skip insertion to avoid duplicates (idempotent invitation flow)
    const alreadyMember = await this.repo.isActiveMember(command.organizationId, normalizedEmail);

    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const id = randomUUID();

    let invitation: OrganizationInvitation;

    if (!alreadyMember) {
      // Revoke any existing pending invitation before creating a new one to avoid
      // accumulating multiple valid tokens for the same email.
      const existing = await this.repo.findPendingInvitationByEmail(command.organizationId, normalizedEmail);
      if (existing) {
        await this.repo.revokeInvitation(existing.id);
        this.logger.log(
          `Revoked previous pending invitation ${existing.id} for email ${normalizedEmail} in org ${command.organizationId}`,
        );
      }

      invitation = await this.repo.createInvitation({
        id,
        organizationId: command.organizationId,
        inviterId: command.inviterId,
        email: normalizedEmail,
        role: command.role,
        tokenHash,
        expiresAt,
      });
    } else {
      // Return synthetic result without creating DB record
      this.logger.log(
        `Invitation skipped — email is already an active member of org ${command.organizationId}`,
      );
      return {
        id,
        email: normalizedEmail,
        role: command.role,
        expiresAt,
        rawToken,
      };
    }

    const acceptLink = `/invitations/${rawToken}/accept`;
    this.logger.log(`[DEV] Invitation acceptance link: ${acceptLink}`);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      rawToken,
    };
  }
}
