import { Inject, Injectable } from '@nestjs/common';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
} from '../../domain/ports/organization-invitation-repository.port';
import {
  MemberNotFoundError,
  LastOwnerProtectionError,
} from '../../domain/organization.errors';

export { MemberNotFoundError, LastOwnerProtectionError };

export interface RemoveOrganizationMemberCommand {
  organizationId: string;
  memberId: string;
}

@Injectable()
export class RemoveOrganizationMemberUseCase {
  constructor(
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: RemoveOrganizationMemberCommand): Promise<void> {
    // Atomically validates OWNER protection and soft-deletes member inside a DB transaction.
    // Throws MemberNotFoundError or LastOwnerProtectionError on violation.
    await this.repo.removeMemberAtomically(command.memberId, command.organizationId);
  }
}
