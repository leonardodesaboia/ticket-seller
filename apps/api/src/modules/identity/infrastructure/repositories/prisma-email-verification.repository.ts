import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IEmailVerificationRepository,
  CreateEmailVerificationTokenInput,
  EmailVerificationTokenRecord,
} from '../../domain/ports/email-verification.repository.port';

@Injectable()
export class PrismaEmailVerificationRepository implements IEmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEmailVerificationTokenInput): Promise<{ id: string }> {
    const token = await this.prisma.emailVerificationToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    return { id: token.id };
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null> {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, tokenHash: true, expiresAt: true, usedAt: true },
    });
    if (!token) return null;
    return token;
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async markIdentityEmailVerified(userId: string): Promise<void> {
    await this.prisma.identity.updateMany({
      where: { userId, provider: 'local' },
      data: { emailVerified: true },
    });
  }
}
