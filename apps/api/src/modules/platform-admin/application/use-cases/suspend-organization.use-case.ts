import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ADMIN_ORGANIZATION_REPOSITORY,
  IAdminOrganizationRepository,
} from '../../domain/ports/admin-organization-repository.port';

export interface SuspendOrganizationCommand {
  actorId: string;
  organizationId: string;
  reason: string;
}

@Injectable()
export class SuspendOrganizationUseCase {
  private readonly logger = new Logger(SuspendOrganizationUseCase.name);

  constructor(
    @Inject(ADMIN_ORGANIZATION_REPOSITORY)
    private readonly orgRepo: IAdminOrganizationRepository,
  ) {}

  async execute(command: SuspendOrganizationCommand): Promise<void> {
    const org = await this.orgRepo.findById(command.organizationId);

    if (!org) throw new NotFoundException('Organization not found');

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
