import { createHash } from 'crypto';
import { ValidationError } from '../../../../shared/kernel/application-errors';
import { type IEmailVerificationRepository } from '../../domain/ports/email-verification.repository.port';

export interface VerifyEmailInput {
  token: string;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly emailVerificationRepository: IEmailVerificationRepository,
  ) {}

  async execute(input: VerifyEmailInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    const record = await this.emailVerificationRepository.findByTokenHash(tokenHash);

    if (!record) {
      throw new ValidationError('Invalid or expired verification token');
    }

    if (record.usedAt !== null) {
      // Idempotent: already verified — return success
      return;
    }

    if (record.expiresAt <= new Date()) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await this.emailVerificationRepository.markUsed(record.id);
    await this.emailVerificationRepository.markIdentityEmailVerified(record.userId);
  }
}
