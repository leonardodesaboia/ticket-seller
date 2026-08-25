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

function decodeCursor(cursor: string): { id: string; createdAt: Date } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      id: string;
      createdAt: string;
    };
    const createdAt = new Date(decoded.createdAt);
    if (isNaN(createdAt.getTime())) return null;
    return { id: decoded.id, createdAt };
  } catch {
    return null;
  }
}

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64');
}

@Injectable()
export class ListAdminOrganizationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListAdminOrganizationsQuery): Promise<ListAdminOrganizationsResult> {
    const limit = Math.min(query.limit ?? 50, 100);

    const decoded = query.cursor ? decodeCursor(query.cursor) : null;

    const organizations = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, id: { lt: decoded.id } },
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
      take: limit + 1,
    });

    const hasMore = organizations.length > limit;
    const items = hasMore ? organizations.slice(0, limit) : organizations;
    const lastItem = items[items.length - 1];

    return {
      items: items.map((org) => ({
        id: org.id,
        name: org.name,
        suspendedAt: org.suspendedAt,
        createdAt: org.createdAt,
        memberCount: org._count.members,
        eventCount: org._count.events,
      })),
      nextCursor: hasMore && lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null,
    };
  }
}
