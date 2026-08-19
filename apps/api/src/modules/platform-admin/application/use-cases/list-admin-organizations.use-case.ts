import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface AdminOrganizationItem {
  id: string;
  name: string;
  suspendedAt: Date | null;
  createdAt: Date;
  memberCount: number;
  eventCount: number;
}

export interface ListAdminOrganizationsResult {
  items: AdminOrganizationItem[];
  nextCursor: string | null;
}

export interface ListAdminOrganizationsQuery {
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ListAdminOrganizationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListAdminOrganizationsQuery): Promise<ListAdminOrganizationsResult> {
    const limit = Math.min(query.limit ?? 50, 100);

    const organizations = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(query.cursor
          ? { createdAt: { lt: new Date(query.cursor) } }
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
      take: limit + 1,
    });

    const hasMore = organizations.length > limit;
    const items = hasMore ? organizations.slice(0, limit) : organizations;

    return {
      items: items.map((org) => ({
        id: org.id,
        name: org.name,
        suspendedAt: org.suspendedAt,
        createdAt: org.createdAt,
        memberCount: org._count.members,
        eventCount: org._count.events,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }
}
