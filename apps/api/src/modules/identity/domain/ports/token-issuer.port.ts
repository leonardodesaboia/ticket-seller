export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface TokenPayload {
  sub: string;
  jti: string;
}

export interface ITokenIssuer {
  issueAccessToken(payload: TokenPayload): string;
  verifyAccessToken(token: string): TokenPayload | null;
}
