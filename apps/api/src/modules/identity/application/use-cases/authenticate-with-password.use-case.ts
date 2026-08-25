import { HttpStatus, Inject, Injectable, HttpException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PASSWORD_HASHER, type IPasswordHasher } from '../../domain/ports/password-hasher.port';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository.port';
import { TOKEN_ISSUER, type ITokenIssuer } from '../../domain/ports/token-issuer.port';
import { AUTH_ATTEMPT_REPOSITORY, type IAuthAttemptRepository } from '../../domain/ports/auth-attempt.repository.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository.port';

export interface AuthenticateWithPasswordInput {
  email: string;
  password: string;
  ip: string;
  userAgent?: string | undefined;
}

export interface AuthenticateWithPasswordOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;
const GENERIC_ERROR = 'Invalid credentials';

@Injectable()
export class AuthenticateWithPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: ITokenIssuer,
    @Inject(AUTH_ATTEMPT_REPOSITORY) private readonly authAttemptRepository: IAuthAttemptRepository,
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
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const identityWithCredential = await this.userRepository.findIdentityWithCredential(normalizedEmail);

    if (!identityWithCredential) {
      // Dummy hash to equalize timing and prevent email enumeration via side-channel
      await this.hasher.verify('$argon2id$v=19$m=65536,t=3,p=4$dummy$dummydummydummy', input.password);
      await this.authAttemptRepository.record({ email: normalizedEmail, ip: input.ip, outcome: 'FAILURE' });
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    const valid = await this.hasher.verify(identityWithCredential.credentialHash, input.password);
    if (!valid) {
      await this.authAttemptRepository.record({ email: normalizedEmail, ip: input.ip, outcome: 'FAILURE' });
      throw new UnauthorizedException(GENERIC_ERROR);
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
      user: identityWithCredential.user,
    };
  }
}
