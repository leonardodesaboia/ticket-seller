import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PASSWORD_RESET_REPOSITORY, type IPasswordResetRepository } from '../../domain/ports/password-reset.repository.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository.port';
import { env } from '../../../../platform/config/env';

export interface RequestPasswordResetInput {
  email: string;
}

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly passwordResetRepository: IPasswordResetRepository,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const userId = await this.userRepository.findUserIdByEmail(normalizedEmail);

    // Anti-enumeration: always return success regardless of whether email exists
    if (!userId) {
      return;
    }

    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.passwordResetRepository.create({ userId, tokenHash, expiresAt });

    if (env.RESEND_API_KEY) {
      // Email sending would be handled by a notification worker via outbox
    } else if (env.NODE_ENV !== 'production') {
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
      process.stdout.write(`[DEV] Password reset URL for ${normalizedEmail}: ${resetUrl}\n`);
    }
  }
}
