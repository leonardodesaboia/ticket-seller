import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IAdminUserRepository,
  AdminUserListItem,
  AdminUserSuspendTarget,
} from '../../domain/ports/admin-user-repository.port';

@Injectable()
export class PrismaAdminUserRepository implements IAdminUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AdminUserSuspendTarget | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, platformRole: true, suspendedAt: true },
    });
  }

  async findAll(params: {
    cursor: { id: string; createdAt: Date } | null;
    take: number;
  }): Promise<AdminUserListItem[]> {
    return this.prisma.user.findMany({
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
        displayName: true,
        suspendedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: params.take,
    });
  }

  async suspend(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { suspendedAt: new Date() },
    });
  }

  async unsuspend(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { suspendedAt: null },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
