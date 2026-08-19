import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface UnsuspendUserCommand {
  actorId: string;
  userId: string;
  reason: string;
}

@Injectable()
export class UnsuspendUserUseCase {
  private readonly logger = new Logger(UnsuspendUserUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UnsuspendUserCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: command.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: command.userId },
      data: { suspendedAt: null },
    });

    this.logger.log({
      msg: 'platform_admin_action',
      actor: command.actorId,
      resource: 'User',
      action: 'UNSUSPEND',
      resourceId: command.userId,
      reason: command.reason,
    });
  }
}
