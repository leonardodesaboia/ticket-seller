import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';

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

export class RevokeOrganizationInvitationUseCase {
  constructor(
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

    // Idempotent: already revoked or already used → skip
    if (invitation.isRevoked || invitation.isUsed) {
      return;
    }

    await this.repo.revokeInvitation(invitation.id);
  }
}
