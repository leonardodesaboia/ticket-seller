export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  locale: string;
  timezone: string;
  emailVerified: boolean;
}

export interface IdentityWithCredential {
  userId: string;
  user: { id: string; email: string; displayName: string | null };
  credentialHash: string;
  forceReset: boolean;
}

export interface RegisterUserInput {
  email: string;
  displayName: string | null;
  credentialHash: string;
  /** When provided, an email_verification_tokens row is created atomically in the same transaction. */
  emailVerificationToken?: { tokenHash: string; expiresAt: Date };
}

export interface IUserRepository {
  emailExists(email: string): Promise<boolean>;
  findUserIdByEmail(email: string): Promise<string | null>;
  findIdentityWithCredential(email: string): Promise<IdentityWithCredential | null>;
  findProfile(userId: string): Promise<UserProfile | null>;
  register(input: RegisterUserInput): Promise<{ userId: string }>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
