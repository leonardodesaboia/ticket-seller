import { createHash } from 'crypto';
import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import { InvitationAlreadyUsedError } from '../../domain/organization.errors';

export { InvitationAlreadyUsedError };

export interface AcceptOrganizationInvitationCommand {
  rawToken: string;
  userId: string;
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

export class InvitationEmailMismatchError extends Error {
  constructor() {
    super('Invitation was not issued for this account');
    this.name = 'InvitationEmailMismatchError';
  }
}

export class AcceptOrganizationInvitationUseCase {
  constructor(
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

    const actorEmail = await this.repo.findUserEmailById(command.userId);
    if (!actorEmail || actorEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new InvitationEmailMismatchError();
    }

    await this.repo.markInvitationUsed(invitation.id, command.userId);

    return {
      organizationId: invitation.organizationId,
      role: invitation.role,
    };
  }
}
