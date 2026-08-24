import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface SuspendOrganizationCommand {
  actorId: string;
  organizationId: string;
  reason: string;
}

@Injectable()
export class SuspendOrganizationUseCase {
  private readonly logger = new Logger(SuspendOrganizationUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: SuspendOrganizationCommand): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: command.organizationId },
      select: { id: true, suspendedAt: true },
    });

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

    await this.prisma.organization.update({
      where: { id: command.organizationId },
      data: { suspendedAt: new Date() },
    });

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
