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

    // Atomically revoke the existing session — guards against concurrent refresh
    // requests both succeeding on the same token (TOCTOU race).
    const rotated = await this.sessionRepository.rotateByTokenHash(tokenHash);

    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Create replacement session
    const newRawToken = randomUUID();
    const newTokenHash = createHash('sha256').update(newRawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

    const newSession = await this.sessionRepository.create({
      userId: rotated.userId,
      tokenHash: newTokenHash,
      expiresAt,
    });

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
