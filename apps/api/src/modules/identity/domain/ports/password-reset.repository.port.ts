export const PASSWORD_RESET_REPOSITORY = Symbol('PASSWORD_RESET_REPOSITORY');

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface IPasswordResetRepository {
  create(input: CreatePasswordResetTokenInput): Promise<{ id: string }>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string): Promise<void>;
  updateCredentialHash(userId: string, hash: string): Promise<void>;
  /** Atomically mark token used AND update credential hash in one transaction. */
  resetPasswordAtomically(id: string, userId: string, newHash: string): Promise<void>;
}
