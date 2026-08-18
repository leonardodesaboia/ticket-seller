export interface PasswordCredential {
  readonly id: string;
  readonly userId: string;
  readonly hash: string;
  readonly algorithm: string;
  readonly forceReset: boolean;
  readonly lastChangedAt: Date;
  readonly createdAt: Date;
}
