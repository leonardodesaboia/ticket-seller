import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string | null;
  platformRole: string | null;
  suspendedAt: Date | null;
  createdAt: Date;
}

export interface ListAdminUsersResult {
  items: AdminUserItem[];
  nextCursor: string | null;
}

export interface ListAdminUsersQuery {
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ListAdminUsersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListAdminUsersQuery): Promise<ListAdminUsersResult> {
    const limit = Math.min(query.limit ?? 50, 100);

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query.cursor
          ? { createdAt: { lt: new Date(query.cursor) } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        platformRole: true,
        suspendedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        platformRole: user.platformRole,
        suspendedAt: user.suspendedAt,
        createdAt: user.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }
}
