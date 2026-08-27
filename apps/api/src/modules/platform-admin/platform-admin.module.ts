import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { PlatformRoleGuard } from '../../platform/http/guards/platform-role.guard';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';
import { AdminController } from './presentation/controllers/admin.controller';

// Domain ports
import { ADMIN_USER_REPOSITORY, IAdminUserRepository } from './domain/ports/admin-user-repository.port';
import { ADMIN_ORGANIZATION_REPOSITORY, IAdminOrganizationRepository } from './domain/ports/admin-organization-repository.port';
import { ADMIN_PAYOUT_REPOSITORY, IAdminPayoutRepository } from './domain/ports/admin-payout-repository.port';
import { ADMIN_DASHBOARD_REPOSITORY, IAdminDashboardRepository } from './domain/ports/admin-dashboard-repository.port';

// Infrastructure repositories (adapters)
import { PrismaAdminUserRepository } from './infrastructure/repositories/prisma-admin-user.repository';
import { PrismaAdminOrganizationRepository } from './infrastructure/repositories/prisma-admin-organization.repository';
import { PrismaAdminPayoutRepository } from './infrastructure/repositories/prisma-admin-payout.repository';
import { PrismaAdminDashboardRepository } from './infrastructure/repositories/prisma-admin-dashboard.repository';

// Application use cases
import { GetPlatformDashboardUseCase } from './application/use-cases/get-platform-dashboard.use-case';
import { ListAdminOrganizationsUseCase } from './application/use-cases/list-admin-organizations.use-case';
import { ListAdminUsersUseCase } from './application/use-cases/list-admin-users.use-case';
import { SuspendOrganizationUseCase } from './application/use-cases/suspend-organization.use-case';
import { UnsuspendOrganizationUseCase } from './application/use-cases/unsuspend-organization.use-case';
import { SuspendUserUseCase } from './application/use-cases/suspend-user.use-case';
import { UnsuspendUserUseCase } from './application/use-cases/unsuspend-user.use-case';
import { BlockPayoutUseCase } from './application/use-cases/block-payout.use-case';

@Module({
  imports: [HttpModule],
  controllers: [AdminController],
  providers: [
    PlatformRoleGuard,

    // Infrastructure repositories
    PrismaAdminUserRepository,
    PrismaAdminOrganizationRepository,
    PrismaAdminPayoutRepository,
    PrismaAdminDashboardRepository,

    // Port bindings
    { provide: ADMIN_USER_REPOSITORY, useExisting: PrismaAdminUserRepository },
    { provide: ADMIN_ORGANIZATION_REPOSITORY, useExisting: PrismaAdminOrganizationRepository },
    { provide: ADMIN_PAYOUT_REPOSITORY, useExisting: PrismaAdminPayoutRepository },
    { provide: ADMIN_DASHBOARD_REPOSITORY, useExisting: PrismaAdminDashboardRepository },

    // Application use cases — plain factories (no NestJS DI decorators in use cases)
    {
      provide: GetPlatformDashboardUseCase,
      useFactory: (dashboardRepo: IAdminDashboardRepository) =>
        new GetPlatformDashboardUseCase(dashboardRepo),
      inject: [ADMIN_DASHBOARD_REPOSITORY],
    },
    {
      provide: ListAdminOrganizationsUseCase,
      useFactory: (orgRepo: IAdminOrganizationRepository) =>
        new ListAdminOrganizationsUseCase(orgRepo),
      inject: [ADMIN_ORGANIZATION_REPOSITORY],
    },
    {
      provide: ListAdminUsersUseCase,
      useFactory: (userRepo: IAdminUserRepository) =>
        new ListAdminUsersUseCase(userRepo),
      inject: [ADMIN_USER_REPOSITORY],
    },
    {
      provide: SuspendOrganizationUseCase,
      useFactory: (orgRepo: IAdminOrganizationRepository) =>
        new SuspendOrganizationUseCase(orgRepo, new NestLoggerAdapter('SuspendOrganizationUseCase')),
      inject: [ADMIN_ORGANIZATION_REPOSITORY],
    },
    {
      provide: UnsuspendOrganizationUseCase,
      useFactory: (orgRepo: IAdminOrganizationRepository) =>
        new UnsuspendOrganizationUseCase(orgRepo, new NestLoggerAdapter('UnsuspendOrganizationUseCase')),
      inject: [ADMIN_ORGANIZATION_REPOSITORY],
    },
    {
      provide: SuspendUserUseCase,
      useFactory: (userRepo: IAdminUserRepository) =>
        new SuspendUserUseCase(userRepo, new NestLoggerAdapter('SuspendUserUseCase')),
      inject: [ADMIN_USER_REPOSITORY],
    },
    {
      provide: UnsuspendUserUseCase,
      useFactory: (userRepo: IAdminUserRepository) =>
        new UnsuspendUserUseCase(userRepo, new NestLoggerAdapter('UnsuspendUserUseCase')),
      inject: [ADMIN_USER_REPOSITORY],
    },
    {
      provide: BlockPayoutUseCase,
      useFactory: (payoutRepo: IAdminPayoutRepository) =>
        new BlockPayoutUseCase(payoutRepo, new NestLoggerAdapter('BlockPayoutUseCase')),
      inject: [ADMIN_PAYOUT_REPOSITORY],
    },
  ],
})
export class PlatformAdminModule {}
