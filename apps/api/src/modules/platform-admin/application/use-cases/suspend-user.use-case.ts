import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PlatformRole } from '../../../../shared/kernel/platform-role';

export interface SuspendUserCommand {
  actorId: string;
  userId: string;
  reason: string;
}

@Injectable()
export class SuspendUserUseCase {
  private readonly logger = new Logger(SuspendUserUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: SuspendUserCommand): Promise<void> {
    if (command.actorId === command.userId) {
      throw new UnprocessableEntityException('Cannot suspend your own account');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: command.userId },
      select: { id: true, platformRole: true, suspendedAt: true },
    });

    if (target?.platformRole === PlatformRole.PLATFORM_ADMIN) {
      throw new UnprocessableEntityException('Cannot suspend another PLATFORM_ADMIN');
    }

    // Idempotent: already suspended
    if (target?.suspendedAt) {
      this.logger.log({
        msg: 'user already suspended — idempotent noop',
        actor: command.actorId,
        resource: 'User',
        action: 'SUSPEND',
        resourceId: command.userId,
        reason: command.reason,
      });
      return;
    }

    await this.prisma.user.update({
      where: { id: command.userId },
      data: { suspendedAt: new Date() },
    });

    this.logger.log({
      msg: 'platform_admin_action',
      actor: command.actorId,
      resource: 'User',
      action: 'SUSPEND',
      resourceId: command.userId,
      reason: command.reason,
    });
  }
}
