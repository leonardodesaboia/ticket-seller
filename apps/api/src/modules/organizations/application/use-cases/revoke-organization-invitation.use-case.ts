import { Inject, Injectable } from '@nestjs/common';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
} from '../../domain/ports/organization-invitation-repository.port';

export interface RevokeOrganizationInvitationCommand {
  organizationId: string;
  invitationId: string;
}

export class InvitationNotFoundError extends Error {
  constructor() {
    super('Invitation not found');
    this.name = 'InvitationNotFoundError';
  }
}

@Injectable()
export class RevokeOrganizationInvitationUseCase {
  constructor(
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: RevokeOrganizationInvitationCommand): Promise<void> {
    const invitation = await this.repo.findInvitationById(
      command.invitationId,
      command.organizationId,
    );

    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    // Idempotent: already revoked → skip
    if (invitation.isRevoked) {
      return;
    }

    await this.repo.revokeInvitation(invitation.id);
  }
}
