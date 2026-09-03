import { createHash, randomUUID } from 'crypto';
import { RateLimitError, UnauthorizedError } from '../../../../shared/kernel/application-errors';
import { type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { type ISessionRepository } from '../../domain/ports/session.repository.port';
import { type ITokenIssuer } from '../../domain/ports/token-issuer.port';
import { type IAuthAttemptRepository } from '../../domain/ports/auth-attempt.repository.port';
import { type IUserRepository } from '../../domain/ports/user.repository.port';

export interface AuthenticateWithPasswordInput {
  email: string;
  password: string;
  ip: string;
  userAgent?: string | undefined;
}

export interface AuthenticateWithPasswordOutput {
  accessToken: string;
  refreshToken: string;
  mustResetPassword: boolean;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;
const GENERIC_ERROR = 'Invalid credentials';

// Pre-computed argon2id hash (m=65536, t=3, p=4) used when the email is not
// found, so the verify() call takes the same ~50ms as a real credential check.
// Prevents email enumeration via response-time side-channel.
const TIMING_DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$RIdpw3v/zqZ13YvFtmgdAg$cRP7BlSn3nOxAU+PcjE5rkC0fdU3VdDnj/JXngENZE0';

export class AuthenticateWithPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenIssuer: ITokenIssuer,
    private readonly authAttemptRepository: IAuthAttemptRepository,
  ) {}

  async execute(input: AuthenticateWithPasswordInput): Promise<AuthenticateWithPasswordOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Rate limiting: check recent failures
    const recentFailures = await this.authAttemptRepository.countRecentFailures(
      normalizedEmail,
      input.ip,
      WINDOW_MINUTES,
    );

    if (recentFailures >= MAX_FAILURES) {
      await this.authAttemptRepository.record({
        email: normalizedEmail,
        ip: input.ip,
        outcome: 'LOCKED',
      });
      throw new RateLimitError('Too many failed attempts. Try again later.');
    }

    const identityWithCredential = await this.userRepository.findIdentityWithCredential(normalizedEmail);

    if (!identityWithCredential) {
      await this.hasher.verify(TIMING_DUMMY_HASH, input.password);
      await this.authAttemptRepository.record({ email: normalizedEmail, ip: input.ip, outcome: 'FAILURE' });
      throw new UnauthorizedError(GENERIC_ERROR);
    }

    const valid = await this.hasher.verify(identityWithCredential.credentialHash, input.password);
    if (!valid) {
      await this.authAttemptRepository.record({ email: normalizedEmail, ip: input.ip, outcome: 'FAILURE' });
      throw new UnauthorizedError(GENERIC_ERROR);
    }

    // Create session
    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

    const session = await this.sessionRepository.create({
      userId: identityWithCredential.userId,
      tokenHash,
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt,
    });

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: identityWithCredential.userId,
      jti: session.id,
    });

    await this.authAttemptRepository.record({ email: normalizedEmail, ip: input.ip, outcome: 'SUCCESS' });

    return {
      accessToken,
      refreshToken: rawToken,
      mustResetPassword: identityWithCredential.forceReset,
      user: identityWithCredential.user,
    };
  }
}
