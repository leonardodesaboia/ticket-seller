import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ADMIN_USER_REPOSITORY,
  IAdminUserRepository,
} from '../../domain/ports/admin-user-repository.port';

export interface UnsuspendUserCommand {
  actorId: string;
  userId: string;
  reason: string;
}

@Injectable()
export class UnsuspendUserUseCase {
  private readonly logger = new Logger(UnsuspendUserUseCase.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly userRepo: IAdminUserRepository,
  ) {}

  async execute(command: UnsuspendUserCommand): Promise<void> {
    const user = await this.userRepo.findById(command.userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.suspendedAt === null) {
      this.logger.log({
        msg: 'platform_admin_action_noop',
        actor: command.actorId,
        action: 'UNSUSPEND',
        resource: 'User',
        resourceId: command.userId,
        reason: command.reason,
      });
      return;
    }

    await this.userRepo.unsuspend(command.userId);

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
