import {
  IAdminUserRepository,
} from '../../domain/ports/admin-user-repository.port';

export interface AdminUserItem {
  id: string;
  displayName: string | null;
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

export class ListAdminUsersUseCase {
  constructor(
    private readonly userRepo: IAdminUserRepository,
  ) {}

  async execute(query: ListAdminUsersQuery): Promise<ListAdminUsersResult> {
    const limit = Math.min(query.limit ?? 50, 100);

    const decoded = query.cursor ? decodeCursor(query.cursor) : null;

    const users = await this.userRepo.findAll({
      cursor: decoded,
      take: limit + 1,
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const lastItem = items[items.length - 1];

    return {
      items: items.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        suspendedAt: user.suspendedAt,
        createdAt: user.createdAt,
      })),
      nextCursor: hasMore && lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null,
    };
  }
}
