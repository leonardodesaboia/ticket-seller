import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ORGANIZATION_INVITATION_REPOSITORY,
  type IOrganizationInvitationRepository,
} from '../../../modules/organizations/domain/ports/organization-invitation-repository.port';
import {
  OrganizationCapability,
  ROLE_CAPABILITIES,
} from '../../../shared/kernel/organization-capability';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';
import { REQUIRE_CAPABILITY_KEY } from '../decorators/require-capability.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly invitationRepo: IOrganizationInvitationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCapability = this.reflector.getAllAndOverride<OrganizationCapability | undefined>(
      REQUIRE_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredCapability) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown> & { params: Record<string, string> }>();
    const actor = request['actor'] as ICurrentActor | undefined;
    const orgId = request.params['orgId'];

    if (!actor || !orgId) {
      throw new ForbiddenException('Access denied');
    }

    // Check suspension before any role lookup — a suspended org denies all members
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { suspendedAt: true },
    });
    if (org?.suspendedAt) {
      throw new ForbiddenException('Organization suspended');
    }

    const member = await this.invitationRepo.findActiveMemberByUserId(orgId, actor.userId);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    const caps = ROLE_CAPABILITIES[member.role] ?? [];
    if (!caps.includes(requiredCapability)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
