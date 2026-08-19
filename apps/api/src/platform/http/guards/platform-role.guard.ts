import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import {
  PlatformRole,
  PLATFORM_ROLE_HIERARCHY,
} from '../../../shared/kernel/platform-role';
import { REQUIRE_PLATFORM_ROLE_KEY } from '../decorators/require-platform-role.decorator';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';

@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<PlatformRole | undefined>(
      REQUIRE_PLATFORM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const actor = request['actor'] as ICurrentActor | undefined;

    if (!actor) {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { platformRole: true },
    });

    if (!user?.platformRole) {
      throw new ForbiddenException('Insufficient platform permissions');
    }

    const userRoleLevel = PLATFORM_ROLE_HIERARCHY[user.platformRole as PlatformRole];
    const requiredLevel = PLATFORM_ROLE_HIERARCHY[requiredRole];

    if (userRoleLevel === undefined || userRoleLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient platform permissions');
    }

    return true;
  }
}
