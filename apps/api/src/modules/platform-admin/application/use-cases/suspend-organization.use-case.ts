import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { ILogger } from '../../../../shared/kernel/logger.port';
import {
  IAdminOrganizationRepository,
} from '../../domain/ports/admin-organization-repository.port';

export interface SuspendOrganizationCommand {
  actorId: string;
  organizationId: string;
  reason: string;
}

export class SuspendOrganizationUseCase {
  constructor(
    private readonly orgRepo: IAdminOrganizationRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: SuspendOrganizationCommand): Promise<void> {
    const org = await this.orgRepo.findById(command.organizationId);

    if (!org) throw new NotFoundError('Organization not found');

    // Idempotent: if already suspended, return early
    if (org.suspendedAt) {
      this.logger.log({
        msg: 'organization already suspended — idempotent noop',
        actor: command.actorId,
        resource: 'Organization',
        action: 'SUSPEND',
        resourceId: command.organizationId,
        reason: command.reason,
      });
      return;
    }

    await this.orgRepo.suspend(command.organizationId);

    // M4: Revoke active sessions of all organization members immediately upon suspension
    await this.orgRepo.revokeMemberSessions(command.organizationId);

    this.logger.log({
      msg: 'platform_admin_action',
      actor: command.actorId,
      resource: 'Organization',
      action: 'SUSPEND',
      resourceId: command.organizationId,
      reason: command.reason,
    });
  }
}
