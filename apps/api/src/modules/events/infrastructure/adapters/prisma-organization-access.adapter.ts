import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IOrganizationAccessPort,
  OrganizationMemberInfo,
} from '../../domain/ports/organization-access.port';

@Injectable()
export class PrismaOrganizationAccessAdapter implements IOrganizationAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async findMember(organizationId: string, userId: string): Promise<OrganizationMemberInfo | null> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { role: true, status: true },
    });

    if (!member) return null;

    return { role: member.role, status: member.status };
  }
}
