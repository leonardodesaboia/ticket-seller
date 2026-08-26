import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { PlatformRoleGuard } from '../../platform/http/guards/platform-role.guard';
import { AdminController } from './presentation/controllers/admin.controller';

// Domain ports
import { ADMIN_USER_REPOSITORY } from './domain/ports/admin-user-repository.port';
import { ADMIN_ORGANIZATION_REPOSITORY } from './domain/ports/admin-organization-repository.port';
import { ADMIN_PAYOUT_REPOSITORY } from './domain/ports/admin-payout-repository.port';
import { ADMIN_DASHBOARD_REPOSITORY } from './domain/ports/admin-dashboard-repository.port';

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

    // Application use cases
    GetPlatformDashboardUseCase,
    ListAdminOrganizationsUseCase,
    ListAdminUsersUseCase,
    SuspendOrganizationUseCase,
    UnsuspendOrganizationUseCase,
    SuspendUserUseCase,
    UnsuspendUserUseCase,
    BlockPayoutUseCase,
  ],
})
export class PlatformAdminModule {}
