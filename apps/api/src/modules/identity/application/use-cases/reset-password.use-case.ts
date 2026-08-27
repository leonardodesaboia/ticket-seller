import { createHash } from 'crypto';
import { ValidationError } from '../../../../shared/kernel/application-errors';
import { type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { type IPasswordResetRepository } from '../../domain/ports/password-reset.repository.port';
import { type ISessionRepository } from '../../domain/ports/session.repository.port';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly hasher: IPasswordHasher,
    private readonly passwordResetRepository: IPasswordResetRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    const record = await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const newHash = await this.hasher.hash(input.newPassword);

    // Atomic: mark token used AND update credential hash in one transaction.
    // If either step fails, both roll back — no partial state (token consumed but password unchanged).
    await this.passwordResetRepository.resetPasswordAtomically(record.id, record.userId, newHash);
    await this.sessionRepository.revokeAllByUserId(record.userId);
  }
}
