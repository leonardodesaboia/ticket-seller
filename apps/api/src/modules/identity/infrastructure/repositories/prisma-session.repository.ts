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
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, tokenHash: true, expiresAt: true, revokedAt: true },
    });
    if (!session) return null;
    return session;
  }

  async findActiveById(id: string): Promise<ActiveSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { id },
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
}
