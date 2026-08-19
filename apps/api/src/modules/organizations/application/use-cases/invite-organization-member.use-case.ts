import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
} from '../../domain/ports/organization-invitation-repository.port';
import { VALID_ORGANIZATION_ROLES } from '../../../../shared/kernel/organization-capability';
const INVITATION_TTL_DAYS = 7;

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

@Injectable()
export class InviteOrganizationMemberUseCase {
  private readonly logger = new Logger(InviteOrganizationMemberUseCase.name);

  constructor(
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: InviteOrganizationMemberCommand): Promise<InviteOrganizationMemberResult> {
    if (!VALID_ORGANIZATION_ROLES.includes(command.role)) {
      throw new InvalidRoleError(command.role);
    }

    // Security: do not reveal if email is already member — always respond 201
    // But we still skip insertion to avoid duplicates (idempotent invitation flow)
    const alreadyMember = await this.repo.isActiveMember(command.organizationId, command.email);

    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const id = randomUUID();

    let invitation: OrganizationInvitation;

    if (!alreadyMember) {
      invitation = await this.repo.createInvitation({
        id,
        organizationId: command.organizationId,
        inviterId: command.inviterId,
        email: command.email,
        role: command.role,
        tokenHash,
        expiresAt,
      });
    } else {
      // Return synthetic result without creating DB record
      this.logger.debug(
        `Invitation skipped — email is already an active member of org ${command.organizationId}`,
      );
      return {
        id,
        email: command.email,
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
