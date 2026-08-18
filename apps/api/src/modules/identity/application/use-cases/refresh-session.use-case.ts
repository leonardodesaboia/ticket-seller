import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository.port';
import { TOKEN_ISSUER, type ITokenIssuer } from '../../domain/ports/token-issuer.port';

export interface RefreshSessionInput {
  refreshToken: string;
}

export interface RefreshSessionOutput {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: ITokenIssuer,
  ) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');

    const session = await this.sessionRepository.findActiveByTokenHash(tokenHash);

    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke current session (rotation)
    await this.sessionRepository.revokeById(session.id);

    // Create new session
    const newRawToken = randomUUID();
    const newTokenHash = createHash('sha256').update(newRawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

    const newSession = await this.sessionRepository.create({
      userId: session.userId,
      tokenHash: newTokenHash,
      expiresAt,
    });

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: session.userId,
      jti: newSession.id,
    });

    return {
      accessToken,
      refreshToken: newRawToken,
    };
  }
}
