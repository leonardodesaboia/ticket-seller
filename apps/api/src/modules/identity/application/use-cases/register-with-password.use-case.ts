import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PASSWORD_HASHER, type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { EMAIL_VERIFICATION_REPOSITORY, type IEmailVerificationRepository } from '../../domain/ports/email-verification.repository.port';
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: IEmailVerificationRepository,
  ) {}

  async execute(input: RegisterWithPasswordInput): Promise<RegisterWithPasswordOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hash = await this.hasher.hash(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          displayName: input.displayName ?? null,
        },
        select: { id: true },
      });

      await tx.identity.create({
        data: {
          userId: createdUser.id,
          provider: 'local',
          providerUserId: normalizedEmail,
          email: normalizedEmail,
          emailVerified: false,
        },
      });

      await tx.passwordCredential.create({
        data: {
          userId: createdUser.id,
          hash,
          algorithm: 'argon2id',
        },
      });

      return createdUser;
    });

    // Generate email verification token (raw UUID -> SHA-256)
    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.emailVerificationRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    if (env.RESEND_API_KEY) {
      // Email sending would be handled by a notification worker via outbox
    } else {
      // Development mode: token URL is written to stdout for local debugging
      const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
      process.stdout.write(`[DEV] Email verification URL for ${normalizedEmail}: ${verifyUrl}\n`);
    }

    return { userId: user.id };
  }
}
