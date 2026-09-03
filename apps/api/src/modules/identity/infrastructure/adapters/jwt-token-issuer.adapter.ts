import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ITokenIssuer, TokenPayload } from '../../domain/ports/token-issuer.port';

@Injectable()
export class JwtTokenIssuerAdapter implements ITokenIssuer {
  constructor(private readonly jwtService: JwtService) {}

  issueAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign({ sub: payload.sub, jti: payload.jti });
  }

  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = this.jwtService.verify<{ sub: string; jti: string }>(token, { algorithms: ['HS256'] });
      return { sub: decoded.sub, jti: decoded.jti };
    } catch {
      return null;
    }
  }
}
