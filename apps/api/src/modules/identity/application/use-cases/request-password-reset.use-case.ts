import { createHash, randomUUID } from 'crypto';
import { type IPasswordResetRepository } from '../../domain/ports/password-reset.repository.port';
import { type IUserRepository } from '../../domain/ports/user.repository.port';

export interface RequestPasswordResetInput {
  email: string;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordResetRepository: IPasswordResetRepository,
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

  }
}
