export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  expiresAt: Date;
}

export interface ActiveSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ISessionRepository {
  create(session: CreateSessionInput): Promise<{ id: string }>;
  findActiveByTokenHash(tokenHash: string): Promise<ActiveSession | null>;
  findActiveById(id: string): Promise<ActiveSession | null>;
  revokeById(id: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
}
