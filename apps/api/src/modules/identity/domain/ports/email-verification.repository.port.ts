export const EMAIL_VERIFICATION_REPOSITORY = Symbol('EMAIL_VERIFICATION_REPOSITORY');

export interface CreateEmailVerificationTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface EmailVerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface IEmailVerificationRepository {
  create(input: CreateEmailVerificationTokenInput): Promise<{ id: string }>;
  findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null>;
  markUsed(id: string): Promise<void>;
  markIdentityEmailVerified(userId: string): Promise<void>;
}
