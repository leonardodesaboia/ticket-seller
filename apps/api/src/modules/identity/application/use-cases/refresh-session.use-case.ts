import { createHash, randomUUID } from 'crypto';
import { ServiceUnavailableError, UnauthorizedError } from '../../../../shared/kernel/application-errors';
import { type ILogger } from '../../../../shared/kernel/logger.port';
import { type ISessionRepository } from '../../domain/ports/session.repository.port';
import { type ITokenIssuer } from '../../domain/ports/token-issuer.port';

export interface RefreshSessionInput {
  refreshToken: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface RefreshSessionOutput {
  accessToken: string;
  refreshToken: string;
}

export class RefreshSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenIssuer: ITokenIssuer,
    private readonly logger: ILogger,
  ) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');

    // Atomically revoke the existing session — guards against concurrent refresh
    // requests both succeeding on the same token (TOCTOU race).
    const rotated = await this.sessionRepository.rotateByTokenHash(tokenHash);

    if (!rotated) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Create replacement session. If this fails after the rotation succeeded, the
    // user has lost their session without gaining a new one — return 503 so clients
    // know to retry rather than forcing a full re-authentication.
    const newRawToken = randomUUID();
    const newTokenHash = createHash('sha256').update(newRawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

    let newSession: { id: string };
    try {
      newSession = await this.sessionRepository.create({
        userId: rotated.userId,
        tokenHash: newTokenHash,
        expiresAt,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    } catch (err) {
      this.logger.error({
        message: `Session rotation succeeded for userId=${rotated.userId} but new session creation failed — user locked out`,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ServiceUnavailableError('Session refresh temporarily unavailable. Please try again.');
    }

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: rotated.userId,
      jti: newSession.id,
    });

    return {
      accessToken,
      refreshToken: newRawToken,
    };
  }
}
