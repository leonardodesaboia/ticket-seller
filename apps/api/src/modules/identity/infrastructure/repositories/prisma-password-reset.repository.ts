import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IPasswordResetRepository,
  CreatePasswordResetTokenInput,
  PasswordResetTokenRecord,
} from '../../domain/ports/password-reset.repository.port';

@Injectable()
export class PrismaPasswordResetRepository implements IPasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePasswordResetTokenInput): Promise<{ id: string }> {
    const token = await this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    return { id: token.id };
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, tokenHash: true, expiresAt: true, usedAt: true },
    });
    if (!token) return null;
    return token;
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async updateCredentialHash(userId: string, hash: string): Promise<void> {
    await this.prisma.passwordCredential.update({
      where: { userId },
      data: {
        hash,
        lastChangedAt: new Date(),
      },
    });
  }

  async resetPasswordAtomically(id: string, userId: string, newHash: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordCredential.update({
        where: { userId },
        data: { hash: newHash, lastChangedAt: new Date() },
      }),
    ]);
  }
}
