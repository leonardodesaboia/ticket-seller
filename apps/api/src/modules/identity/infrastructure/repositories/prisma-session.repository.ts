import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  ISessionRepository,
  CreateSessionInput,
  ActiveSession,
} from '../../domain/ports/session.repository.port';

@Injectable()
export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<{ id: string }> {
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    return { id: session.id };
  }

  async findActiveByTokenHash(tokenHash: string): Promise<ActiveSession | null> {
    const session = await this.prisma.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gte: new Date() } },
      select: { id: true, userId: true, tokenHash: true, expiresAt: true, revokedAt: true },
    });
    if (!session) return null;
    return session;
  }

  async findActiveById(id: string): Promise<ActiveSession | null> {
    const session = await this.prisma.session.findFirst({
      where: { id, revokedAt: null, expiresAt: { gte: new Date() } },
      select: { id: true, userId: true, tokenHash: true, expiresAt: true, revokedAt: true },
    });
    if (!session) return null;
    return session;
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async rotateByTokenHash(tokenHash: string): Promise<{ userId: string } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ user_id: string }>>`
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash}
        AND revoked_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
    `;
    const row = rows[0] ?? null;
    if (!row) return null;
    return { userId: row.user_id };
  }
}
