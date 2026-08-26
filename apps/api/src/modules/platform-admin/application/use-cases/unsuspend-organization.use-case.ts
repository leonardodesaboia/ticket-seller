import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ADMIN_ORGANIZATION_REPOSITORY,
  IAdminOrganizationRepository,
} from '../../domain/ports/admin-organization-repository.port';

export interface UnsuspendOrganizationCommand {
  actorId: string;
  organizationId: string;
  reason: string;
}

@Injectable()
export class UnsuspendOrganizationUseCase {
  private readonly logger = new Logger(UnsuspendOrganizationUseCase.name);

  constructor(
    @Inject(ADMIN_ORGANIZATION_REPOSITORY)
    private readonly orgRepo: IAdminOrganizationRepository,
  ) {}

  async execute(command: UnsuspendOrganizationCommand): Promise<void> {
    const org = await this.orgRepo.findById(command.organizationId);
    if (!org) throw new NotFoundException('Organization not found');

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
