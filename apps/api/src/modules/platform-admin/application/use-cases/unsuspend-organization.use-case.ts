import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface UnsuspendOrganizationCommand {
  actorId: string;
  organizationId: string;
  reason: string;
}

@Injectable()
export class UnsuspendOrganizationUseCase {
  private readonly logger = new Logger(UnsuspendOrganizationUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UnsuspendOrganizationCommand): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: command.organizationId },
      select: { id: true, suspendedAt: true },
    });
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

    await this.prisma.organization.update({
      where: { id: command.organizationId },
      data: { suspendedAt: null },
    });

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
