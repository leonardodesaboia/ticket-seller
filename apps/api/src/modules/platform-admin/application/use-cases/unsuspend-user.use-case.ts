import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { ILogger } from '../../../../shared/kernel/logger.port';
import {
  IAdminUserRepository,
} from '../../domain/ports/admin-user-repository.port';

export interface UnsuspendUserCommand {
  actorId: string;
  userId: string;
  reason: string;
}

export class UnsuspendUserUseCase {
  constructor(
    private readonly userRepo: IAdminUserRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: UnsuspendUserCommand): Promise<void> {
    const user = await this.userRepo.findById(command.userId);
    if (!user) throw new NotFoundError('User not found');

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
