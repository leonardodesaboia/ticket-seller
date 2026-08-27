import type {
  IOrganizationInvitationRepository,
  OrganizationMemberRecord,
} from '../../domain/ports/organization-invitation-repository.port';

export interface ListOrganizationMembersCommand {
  organizationId: string;
}

export type ListOrganizationMembersResult = OrganizationMemberRecord[];

export class ListOrganizationMembersUseCase {
  constructor(
    private readonly repo: IOrganizationInvitationRepository,
  ) {}

  async execute(command: ListOrganizationMembersCommand): Promise<ListOrganizationMembersResult> {
    return this.repo.listActiveMembers(command.organizationId);
  }
}
