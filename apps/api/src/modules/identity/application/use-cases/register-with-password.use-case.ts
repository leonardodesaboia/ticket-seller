import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { PASSWORD_HASHER, type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { EMAIL_VERIFICATION_REPOSITORY, type IEmailVerificationRepository } from '../../domain/ports/email-verification.repository.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository.port';
import { env } from '../../../../platform/config/env';

export interface RegisterWithPasswordInput {
  email: string;
  password: string;
  displayName?: string | undefined;
}

export interface RegisterWithPasswordOutput {
  userId: string;
}

@Injectable()
export class RegisterWithPasswordUseCase {
  private readonly logger = new Logger(RegisterWithPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: IEmailVerificationRepository,
  ) {}

  async execute(input: RegisterWithPasswordInput): Promise<RegisterWithPasswordOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();

    if (await this.userRepository.emailExists(normalizedEmail)) {
      throw new ConflictException('Email already registered');
    }

    const credentialHash = await this.hasher.hash(input.password);

    const { userId } = await this.userRepository.register({
      email: normalizedEmail,
      displayName: input.displayName ?? null,
      credentialHash,
    });

    // Generate email verification token (raw UUID -> SHA-256)
    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Email verification token creation is outside the user registration transaction.
    // If it fails, the user is already created — log a critical warning so ops can
    // trigger a resend. Do NOT propagate the error: the registration itself succeeded.
    try {
      await this.emailVerificationRepository.create({ userId, tokenHash, expiresAt });

      if (env.RESEND_API_KEY) {
        // Email sending would be handled by a notification worker via outbox
      } else if (env.NODE_ENV !== 'production') {
        const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
        process.stdout.write(`[DEV] Email verification URL for ${normalizedEmail}: ${verifyUrl}\n`);
      }
    } catch (err) {
      this.logger.error(
        `User ${userId} created but email verification token could not be persisted — requires manual resend`,
        err,
      );
    }

    return { userId };
  }
}
