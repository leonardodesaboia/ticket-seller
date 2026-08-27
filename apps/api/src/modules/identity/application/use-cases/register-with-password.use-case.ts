import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { ConflictError } from '../../../../shared/kernel/application-errors';
import { type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { type IUserRepository } from '../../domain/ports/user.repository.port';

export interface RegisterWithPasswordInput {
  email: string;
  password: string;
  displayName?: string | undefined;
}

export interface RegisterWithPasswordOutput {
  userId: string;
}

export class RegisterWithPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  async execute(input: RegisterWithPasswordInput): Promise<RegisterWithPasswordOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();

    if (await this.userRepository.emailExists(normalizedEmail)) {
      throw new ConflictError('Email already registered');
    }

    const credentialHash = await this.hasher.hash(input.password);

    // Generate email verification token (raw UUID -> SHA-256) before registration
    // so the token is created atomically with the user in a single transaction.
    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const { userId } = await this.userRepository.register({
      email: normalizedEmail,
      displayName: input.displayName ?? null,
      credentialHash,
      emailVerificationToken: { tokenHash, expiresAt },
    });

    return { userId };
  }
}
