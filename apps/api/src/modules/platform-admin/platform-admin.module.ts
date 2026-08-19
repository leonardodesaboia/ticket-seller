import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { PlatformRoleGuard } from '../../platform/http/guards/platform-role.guard';
import { AdminController } from './presentation/controllers/admin.controller';
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
