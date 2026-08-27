import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { InviteOrganizationMemberUseCase } from './application/use-cases/invite-organization-member.use-case';
import { AcceptOrganizationInvitationUseCase } from './application/use-cases/accept-organization-invitation.use-case';
import { RevokeOrganizationInvitationUseCase } from './application/use-cases/revoke-organization-invitation.use-case';
import { ListOrganizationMembersUseCase } from './application/use-cases/list-organization-members.use-case';
import { UpdateMemberRoleUseCase } from './application/use-cases/update-member-role.use-case';
import { RemoveOrganizationMemberUseCase } from './application/use-cases/remove-organization-member.use-case';
import { ORGANIZATION_REPOSITORY, type IOrganizationRepository } from './domain/ports/organization-repository.port';
import { ORGANIZATION_INVITATION_REPOSITORY, type IOrganizationInvitationRepository } from './domain/ports/organization-invitation-repository.port';
import { PrismaOrganizationRepository } from './infrastructure/repositories/prisma-organization.repository';
import { PrismaOrganizationInvitationRepository } from './infrastructure/repositories/prisma-organization-invitation.repository';
import { PrismaOrganizationAccessAdapter } from './infrastructure/adapters/prisma-organization-access.adapter';
import { ORGANIZATION_ACCESS_PORT } from './contracts/organization-access.contract';
import { OrganizationsController } from './presentation/organizations.controller';
import { OrganizationMembersController } from './presentation/controllers/organization-members.controller';
import { InvitationsController } from './presentation/controllers/invitations.controller';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';

@Module({
  imports: [HttpModule],
  controllers: [OrganizationsController, OrganizationMembersController, InvitationsController],
  providers: [
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: ORGANIZATION_INVITATION_REPOSITORY, useClass: PrismaOrganizationInvitationRepository },
    { provide: ORGANIZATION_ACCESS_PORT, useClass: PrismaOrganizationAccessAdapter },
    OrganizationRoleGuard,
    {
      provide: CreateOrganizationUseCase,
      useFactory: (repo: IOrganizationRepository) =>
        new CreateOrganizationUseCase(repo),
      inject: [ORGANIZATION_REPOSITORY],
    },
    {
      provide: InviteOrganizationMemberUseCase,
      useFactory: (repo: IOrganizationInvitationRepository) =>
        new InviteOrganizationMemberUseCase(repo, new NestLoggerAdapter('InviteOrganizationMemberUseCase')),
      inject: [ORGANIZATION_INVITATION_REPOSITORY],
    },
    {
      provide: AcceptOrganizationInvitationUseCase,
      useFactory: (repo: IOrganizationInvitationRepository) =>
        new AcceptOrganizationInvitationUseCase(repo),
      inject: [ORGANIZATION_INVITATION_REPOSITORY],
    },
    {
      provide: RevokeOrganizationInvitationUseCase,
      useFactory: (repo: IOrganizationInvitationRepository) =>
        new RevokeOrganizationInvitationUseCase(repo),
      inject: [ORGANIZATION_INVITATION_REPOSITORY],
    },
    {
      provide: ListOrganizationMembersUseCase,
      useFactory: (repo: IOrganizationInvitationRepository) =>
        new ListOrganizationMembersUseCase(repo),
      inject: [ORGANIZATION_INVITATION_REPOSITORY],
    },
    {
      provide: UpdateMemberRoleUseCase,
      useFactory: (repo: IOrganizationInvitationRepository) =>
        new UpdateMemberRoleUseCase(repo),
      inject: [ORGANIZATION_INVITATION_REPOSITORY],
    },
    {
      provide: RemoveOrganizationMemberUseCase,
      useFactory: (repo: IOrganizationInvitationRepository) =>
        new RemoveOrganizationMemberUseCase(repo),
      inject: [ORGANIZATION_INVITATION_REPOSITORY],
    },
  ],
  exports: [ORGANIZATION_INVITATION_REPOSITORY, ORGANIZATION_ACCESS_PORT],
})
export class OrganizationsModule {}
