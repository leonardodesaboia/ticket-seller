import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { ILogger } from '../../../../shared/kernel/logger.port';
import {
  IAdminOrganizationRepository,
} from '../../domain/ports/admin-organization-repository.port';

export interface UnsuspendOrganizationCommand {
  actorId: string;
  organizationId: string;
  reason: string;
}

export class UnsuspendOrganizationUseCase {
  constructor(
    private readonly orgRepo: IAdminOrganizationRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: UnsuspendOrganizationCommand): Promise<void> {
    const org = await this.orgRepo.findById(command.organizationId);
    if (!org) throw new NotFoundError('Organization not found');

    if (org.suspendedAt === null) {
      this.logger.log({
        msg: 'platform_admin_action_noop',
        actor: command.actorId,
        action: 'UNSUSPEND',
        resource: 'Organization',
        resourceId: command.organizationId,
        reason: command.reason,
      });
      return;
    }

    await this.orgRepo.unsuspend(command.organizationId);

    this.logger.log({
      msg: 'platform_admin_action',
      actor: command.actorId,
      resource: 'Organization',
      action: 'UNSUSPEND',
      resourceId: command.organizationId,
      reason: command.reason,
    });
  }
}
