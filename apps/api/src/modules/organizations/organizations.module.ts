import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { InviteOrganizationMemberUseCase } from './application/use-cases/invite-organization-member.use-case';
import { AcceptOrganizationInvitationUseCase } from './application/use-cases/accept-organization-invitation.use-case';
import { RevokeOrganizationInvitationUseCase } from './application/use-cases/revoke-organization-invitation.use-case';
import { ListOrganizationMembersUseCase } from './application/use-cases/list-organization-members.use-case';
import { UpdateMemberRoleUseCase } from './application/use-cases/update-member-role.use-case';
import { RemoveOrganizationMemberUseCase } from './application/use-cases/remove-organization-member.use-case';
import { ORGANIZATION_REPOSITORY } from './domain/ports/organization-repository.port';
import { ORGANIZATION_INVITATION_REPOSITORY } from './domain/ports/organization-invitation-repository.port';
import { PrismaOrganizationRepository } from './infrastructure/repositories/prisma-organization.repository';
import { PrismaOrganizationInvitationRepository } from './infrastructure/repositories/prisma-organization-invitation.repository';
import { OrganizationsController } from './presentation/organizations.controller';
import { OrganizationMembersController } from './presentation/controllers/organization-members.controller';
import { InvitationsController } from './presentation/controllers/invitations.controller';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';

@Module({
  imports: [HttpModule],
  controllers: [OrganizationsController, OrganizationMembersController, InvitationsController],
  providers: [
    CreateOrganizationUseCase,
    InviteOrganizationMemberUseCase,
    AcceptOrganizationInvitationUseCase,
    RevokeOrganizationInvitationUseCase,
    ListOrganizationMembersUseCase,
    UpdateMemberRoleUseCase,
    RemoveOrganizationMemberUseCase,
    OrganizationRoleGuard,
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: ORGANIZATION_INVITATION_REPOSITORY, useClass: PrismaOrganizationInvitationRepository },
  ],
  exports: [ORGANIZATION_INVITATION_REPOSITORY],
})
export class OrganizationsModule {}
