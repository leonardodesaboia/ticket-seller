import { Inject, Injectable } from '@nestjs/common';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
  type OrganizationMemberRecord,
} from '../../domain/ports/organization-invitation-repository.port';

export interface ListOrganizationMembersCommand {
  organizationId: string;
}

export type ListOrganizationMembersResult = OrganizationMemberRecord[];

@Injectable()
export class ListOrganizationMembersUseCase {
  constructor(
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: ListOrganizationMembersCommand): Promise<ListOrganizationMembersResult> {
    return this.repo.listActiveMembers(command.organizationId);
  }
}
