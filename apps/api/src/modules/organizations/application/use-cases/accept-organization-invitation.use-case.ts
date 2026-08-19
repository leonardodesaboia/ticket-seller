import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
} from '../../domain/ports/organization-invitation-repository.port';
import { InvitationAlreadyUsedError } from '../../domain/organization.errors';

export { InvitationAlreadyUsedError };

export interface AcceptOrganizationInvitationCommand {
  rawToken: string;
  /** Optional — if provided, the new member record will be linked to this user */
  userId?: string | undefined;
}

export interface AcceptOrganizationInvitationResult {
  organizationId: string;
  role: string;
}

export class InvitationNotFoundError extends Error {
  constructor() {
    super('Invitation not found');
    this.name = 'InvitationNotFoundError';
  }
}

export class InvitationRevokedError extends Error {
  constructor() {
    super('Invitation has been revoked');
    this.name = 'InvitationRevokedError';
  }
}

export class InvitationExpiredError extends Error {
  constructor() {
    super('Invitation has expired');
    this.name = 'InvitationExpiredError';
  }
}

@Injectable()
export class AcceptOrganizationInvitationUseCase {
  constructor(
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: AcceptOrganizationInvitationCommand): Promise<AcceptOrganizationInvitationResult> {
    const tokenHash = createHash('sha256').update(command.rawToken).digest('hex');
    const invitation = await this.repo.findInvitationByTokenHash(tokenHash);

    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    if (invitation.isUsed) {
      throw new InvitationAlreadyUsedError();
    }

    if (invitation.isRevoked) {
      throw new InvitationRevokedError();
    }

    if (invitation.isExpired) {
      throw new InvitationExpiredError();
    }

    await this.repo.markInvitationUsed(invitation.id, command.userId ?? invitation.inviterId);

    return {
      organizationId: invitation.organizationId,
      role: invitation.role,
    };
  }
}
