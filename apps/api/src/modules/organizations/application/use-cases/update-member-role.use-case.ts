import { Inject, Injectable } from '@nestjs/common';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
} from '../../domain/ports/organization-invitation-repository.port';
import {
  MemberNotFoundError,
  LastOwnerProtectionError,
  InsufficientRoleToAssignError,
} from '../../domain/organization.errors';
import {
  VALID_ORGANIZATION_ROLES,
  ROLE_CAPABILITIES,
  OrganizationCapability,
} from '../../../../shared/kernel/organization-capability';

export { MemberNotFoundError, LastOwnerProtectionError, InsufficientRoleToAssignError };

export interface UpdateMemberRoleCommand {
  organizationId: string;
  memberId: string;
  newRole: string;
  actorUserId: string;
}

export class InvalidRoleError extends Error {
  constructor(role: string) {
    super(`Invalid role: ${role}`);
    this.name = 'InvalidRoleError';
  }
}

@Injectable()
export class UpdateMemberRoleUseCase {
  constructor(
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: UpdateMemberRoleCommand): Promise<void> {
    if (!VALID_ORGANIZATION_ROLES.includes(command.newRole)) {
      throw new InvalidRoleError(command.newRole);
    }

    // Defense-in-depth: only an actor with ROLES_ASSIGN capability can promote to OWNER,
    // regardless of whatever the route guard currently permits.
    if (command.newRole === 'OWNER') {
      const actorMember = await this.repo.findActiveMemberByUserId(command.organizationId, command.actorUserId);
      const actorCapabilities = actorMember ? (ROLE_CAPABILITIES[actorMember.role] ?? []) : [];
      if (!actorCapabilities.includes(OrganizationCapability.ROLES_ASSIGN)) {
        throw new InsufficientRoleToAssignError();
      }
    }

    // Atomically validates OWNER protection and updates role inside a DB transaction.
    // Throws MemberNotFoundError or LastOwnerProtectionError on violation.
    await this.repo.updateMemberRoleAtomically(command.memberId, command.organizationId, command.newRole);
  }
}
