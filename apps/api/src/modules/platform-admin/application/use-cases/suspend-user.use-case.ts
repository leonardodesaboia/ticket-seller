import { Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  ADMIN_USER_REPOSITORY,
  IAdminUserRepository,
} from '../../domain/ports/admin-user-repository.port';

export interface SuspendUserCommand {
  actorId: string;
  userId: string;
  reason: string;
}

@Injectable()
export class SuspendUserUseCase {
  private readonly logger = new Logger(SuspendUserUseCase.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly userRepo: IAdminUserRepository,
  ) {}

  async execute(command: SuspendUserCommand): Promise<void> {
    if (command.actorId === command.userId) {
      throw new UnprocessableEntityException('Cannot suspend your own account');
    }

    const target = await this.userRepo.findById(command.userId);

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.platformRole !== null) {
      throw new UnprocessableEntityException('Cannot suspend a platform admin account');
    }

    // Idempotent: already suspended
    if (target.suspendedAt) {
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

    await this.userRepo.suspend(command.userId);
    await this.userRepo.revokeAllSessions(command.userId);

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
