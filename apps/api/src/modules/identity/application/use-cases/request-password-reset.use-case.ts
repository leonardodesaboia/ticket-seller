import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PASSWORD_RESET_REPOSITORY, type IPasswordResetRepository } from '../../domain/ports/password-reset.repository.port';
import { env } from '../../../../platform/config/env';

export interface RequestPasswordResetInput {
  email: string;
}

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly passwordResetRepository: IPasswordResetRepository,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const identity = await this.prisma.identity.findFirst({
      where: { provider: 'local', providerUserId: normalizedEmail },
      select: { userId: true },
    });

    // Anti-enumeration: always return success regardless of whether email exists
    if (!identity) {
      return;
    }

    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.passwordResetRepository.create({
      userId: identity.userId,
      tokenHash,
      expiresAt,
    });

    if (env.RESEND_API_KEY) {
      // Email sending would be handled by a notification worker via outbox
    } else {
      // Development mode: token URL is written to stdout for local debugging
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
      process.stdout.write(`[DEV] Password reset URL for ${normalizedEmail}: ${resetUrl}\n`);
    }
  }
}
