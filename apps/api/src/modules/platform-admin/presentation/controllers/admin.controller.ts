import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { PlatformRoleGuard } from '../../../../platform/http/guards/platform-role.guard';
import { SmartThrottlerGuard } from '../../../../platform/http/guards/smart-throttler.guard';
import { RequirePlatformRole } from '../../../../platform/http/decorators/require-platform-role.decorator';
import { AdminReadThrottle, AdminActionThrottle } from '../../../../platform/http/decorators/throttle.decorator';
import { PlatformRole } from '../../../../shared/kernel/platform-role';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { SuspendDto } from '../dtos/suspend.dto';
import { GetPlatformDashboardUseCase } from '../../application/use-cases/get-platform-dashboard.use-case';
import { ListAdminOrganizationsUseCase } from '../../application/use-cases/list-admin-organizations.use-case';
import { ListAdminUsersUseCase } from '../../application/use-cases/list-admin-users.use-case';
import { SuspendOrganizationUseCase } from '../../application/use-cases/suspend-organization.use-case';
import { UnsuspendOrganizationUseCase } from '../../application/use-cases/unsuspend-organization.use-case';
import { SuspendUserUseCase } from '../../application/use-cases/suspend-user.use-case';
import { UnsuspendUserUseCase } from '../../application/use-cases/unsuspend-user.use-case';
import { BlockPayoutUseCase } from '../../application/use-cases/block-payout.use-case';

@Controller('admin')
@UseGuards(ActorGuard, PlatformRoleGuard, SmartThrottlerGuard)
@RequirePlatformRole(PlatformRole.PLATFORM_SUPPORT)
export class AdminController {
  constructor(
    private readonly getDashboard: GetPlatformDashboardUseCase,
    private readonly listOrganizations: ListAdminOrganizationsUseCase,
    private readonly listUsers: ListAdminUsersUseCase,
    private readonly suspendOrg: SuspendOrganizationUseCase,
    private readonly unsuspendOrg: UnsuspendOrganizationUseCase,
    private readonly suspendUser: SuspendUserUseCase,
    private readonly unsuspendUser: UnsuspendUserUseCase,
    private readonly blockPayout: BlockPayoutUseCase,
  ) {}

  @Get('dashboard')
  @AdminReadThrottle()
  async dashboard() {
    return this.getDashboard.execute();
  }

  @Get('organizations')
  @AdminReadThrottle()
  async organizations(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const query: { cursor?: string; limit?: number } = {};
    if (cursor !== undefined) query.cursor = cursor;
    if (limit !== undefined) {
      query.limit = Math.min(
        Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 50),
        100,
      );
    }
    return this.listOrganizations.execute(query);
  }

  @Get('users')
  @AdminReadThrottle()
  async users(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const query: { cursor?: string; limit?: number } = {};
    if (cursor !== undefined) query.cursor = cursor;
    if (limit !== undefined) {
      query.limit = Math.min(
        Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 50),
        100,
      );
    }
    return this.listUsers.execute(query);
  }

  @Post('organizations/:orgId/suspend')
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  @AdminActionThrottle()
  async suspendOrganization(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Body() dto: SuspendDto,
    @CurrentActor() actor: ICurrentActor,
  ) {
    await this.suspendOrg.execute({
      actorId: actor.userId,
      organizationId: orgId,
      reason: dto.reason,
    });
    return { success: true };
  }

  @Post('organizations/:orgId/unsuspend')
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  @AdminActionThrottle()
  async unsuspendOrganization(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Body() dto: SuspendDto,
    @CurrentActor() actor: ICurrentActor,
  ) {
    await this.unsuspendOrg.execute({
      actorId: actor.userId,
      organizationId: orgId,
      reason: dto.reason,
    });
    return { success: true };
  }

  @Post('users/:userId/suspend')
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  @AdminActionThrottle()
  async suspendUserEndpoint(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: SuspendDto,
    @CurrentActor() actor: ICurrentActor,
  ) {
    await this.suspendUser.execute({
      actorId: actor.userId,
      userId,
      reason: dto.reason,
    });
    return { success: true };
  }

  @Post('users/:userId/unsuspend')
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  @AdminActionThrottle()
  async unsuspendUserEndpoint(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: SuspendDto,
    @CurrentActor() actor: ICurrentActor,
  ) {
    await this.unsuspendUser.execute({
      actorId: actor.userId,
      userId,
      reason: dto.reason,
    });
    return { success: true };
  }

  @Post('payouts/:payoutId/block')
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  @AdminActionThrottle()
  async blockPayoutEndpoint(
    @Param('payoutId', new ParseUUIDPipe({ version: '4' })) payoutId: string,
    @Body() dto: SuspendDto,
    @CurrentActor() actor: ICurrentActor,
  ) {
    await this.blockPayout.execute({
      actorId: actor.userId,
      payoutId,
      reason: dto.reason,
    });
    return { success: true };
  }
}
