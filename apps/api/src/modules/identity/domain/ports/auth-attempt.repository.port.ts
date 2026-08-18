import type { AuthOutcome } from '../entities/auth-attempt.entity';

export const AUTH_ATTEMPT_REPOSITORY = Symbol('AUTH_ATTEMPT_REPOSITORY');

export interface RecordAttemptInput {
  email: string;
  ip: string;
  outcome: AuthOutcome;
}

export interface IAuthAttemptRepository {
  record(input: RecordAttemptInput): Promise<void>;
  countRecentFailures(email: string, ip: string, sinceMinutes: number): Promise<number>;
}
