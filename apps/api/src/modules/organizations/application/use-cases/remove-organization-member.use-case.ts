import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import {
  MemberNotFoundError,
  LastOwnerProtectionError,
  CannotRemoveSelfError,
} from '../../domain/organization.errors';

export { MemberNotFoundError, LastOwnerProtectionError, CannotRemoveSelfError };

export interface RemoveOrganizationMemberCommand {
  organizationId: string;
  memberId: string;
  actorUserId: string;
}

export class RemoveOrganizationMemberUseCase {
  constructor(
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: RemoveOrganizationMemberCommand): Promise<void> {
    // Atomically validates: OWNER protection, self-removal guard, and soft-deletes.
    // Throws MemberNotFoundError, LastOwnerProtectionError, or CannotRemoveSelfError.
    await this.repo.removeMemberAtomically(command.memberId, command.organizationId, command.actorUserId);
  }
}
