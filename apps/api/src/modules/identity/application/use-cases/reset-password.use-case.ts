import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PASSWORD_HASHER, type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { PASSWORD_RESET_REPOSITORY, type IPasswordResetRepository } from '../../domain/ports/password-reset.repository.port';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository.port';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly passwordResetRepository: IPasswordResetRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    const record = await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newHash = await this.hasher.hash(input.newPassword);

    // Mark token used first — prevents replay even if subsequent steps fail
    await this.passwordResetRepository.markUsed(record.id);
    await this.passwordResetRepository.updateCredentialHash(record.userId, newHash);
    await this.sessionRepository.revokeAllByUserId(record.userId);
  }
}
