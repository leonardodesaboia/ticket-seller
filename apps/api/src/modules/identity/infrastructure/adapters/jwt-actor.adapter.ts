import { Inject, Injectable } from '@nestjs/common';
import type { IActorAdapter } from '../../../../platform/http/actor-adapter.port';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { TOKEN_ISSUER, type ITokenIssuer } from '../../domain/ports/token-issuer.port';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository.port';

@Injectable()
export class JwtActorAdapter implements IActorAdapter {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: ITokenIssuer,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
  ) {}

  async resolve(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ICurrentActor | null> {
    const authHeader = request.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') return null;
    if (!authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const payload = this.tokenIssuer.verifyAccessToken(token);
    if (!payload) return null;

    // jti is the session id — verify session is active in DB
    const session = await this.sessionRepository.findActiveById(payload.jti);
    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      return null;
    }

    return { userId: payload.sub, sessionId: session.id };
  }
}
