import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_ORGANIZATION_REPOSITORY,
  IAdminOrganizationRepository,
} from '../../domain/ports/admin-organization-repository.port';

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
  constructor(
    @Inject(ADMIN_ORGANIZATION_REPOSITORY)
    private readonly orgRepo: IAdminOrganizationRepository,
  ) {}

  async execute(query: ListAdminOrganizationsQuery): Promise<ListAdminOrganizationsResult> {
    const limit = Math.min(query.limit ?? 50, 100);

    const decoded = query.cursor ? decodeCursor(query.cursor) : null;

    const organizations = await this.orgRepo.findAll({
      cursor: decoded,
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
        memberCount: org.memberCount,
        eventCount: org.eventCount,
      })),
      nextCursor: hasMore && lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null,
    };
  }
}
