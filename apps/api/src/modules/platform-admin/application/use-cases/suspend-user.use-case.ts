import { NotFoundError, UnprocessableError } from '../../../../shared/kernel/application-errors';
import { ILogger } from '../../../../shared/kernel/logger.port';
import {
  IAdminUserRepository,
} from '../../domain/ports/admin-user-repository.port';

export interface SuspendUserCommand {
  actorId: string;
  userId: string;
  reason: string;
}

export class SuspendUserUseCase {
  constructor(
    private readonly userRepo: IAdminUserRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: SuspendUserCommand): Promise<void> {
    if (command.actorId === command.userId) {
      throw new UnprocessableError('Cannot suspend your own account');
    }

    const target = await this.userRepo.findById(command.userId);

    if (!target) {
      throw new NotFoundError('User not found');
    }

    if (target.platformRole !== null) {
      throw new UnprocessableError('Cannot suspend a platform admin account');
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
