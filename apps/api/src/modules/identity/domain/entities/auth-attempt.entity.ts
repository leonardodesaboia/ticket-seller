export type AuthOutcome = 'SUCCESS' | 'FAILURE' | 'LOCKED';

export interface AuthAttempt {
  readonly id: string;
  readonly email: string;
  readonly ip: string;
  readonly outcome: AuthOutcome;
  readonly attemptedAt: Date;
}
