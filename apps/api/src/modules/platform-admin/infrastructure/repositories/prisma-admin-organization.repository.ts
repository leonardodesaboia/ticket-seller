import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IAdminOrganizationRepository,
  AdminOrganizationListItem,
  AdminOrganizationSuspendTarget,
} from '../../domain/ports/admin-organization-repository.port';

@Injectable()
export class PrismaAdminOrganizationRepository implements IAdminOrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AdminOrganizationSuspendTarget | null> {
    return this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, suspendedAt: true },
    });
  }

  async findAll(params: {
    cursor: { id: string; createdAt: Date } | null;
    take: number;
  }): Promise<AdminOrganizationListItem[]> {
    const rows = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(params.cursor
          ? {
              OR: [
                { createdAt: { lt: params.cursor.createdAt } },
                { createdAt: params.cursor.createdAt, id: { lt: params.cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        suspendedAt: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            events: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: params.take,
    });

    return rows.map((org) => ({
      id: org.id,
      name: org.name,
      suspendedAt: org.suspendedAt,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      eventCount: org._count.events,
    }));
  }

  async suspend(id: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id },
      data: { suspendedAt: new Date() },
    });
  }

  async unsuspend(id: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id },
      data: { suspendedAt: null },
    });
  }

  /**
   * Revokes all active sessions for active members of the suspended organization.
   *
   * Decision: implemented via a direct Prisma query joining organization_members.
   * This avoids cross-module coupling with the identity module's ISessionRepository
   * while keeping the operation atomic at the database level.
   * The query targets only non-removed members (removedAt IS NULL) with active
   * sessions (revokedAt IS NULL).
   */
  async revokeMemberSessions(organizationId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE user_id IN (
        SELECT user_id
        FROM organization_members
        WHERE organization_id = ${organizationId}::uuid
          AND removed_at IS NULL
      )
      AND revoked_at IS NULL
    `;
  }
}
