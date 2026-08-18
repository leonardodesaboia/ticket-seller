export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export function isSessionActive(session: Session): boolean {
  return session.revokedAt === null && session.expiresAt > new Date();
}
