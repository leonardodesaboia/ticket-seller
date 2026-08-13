import { CheckIn, CheckInResult, CheckInSource } from '../check-in.entity';

export const CHECK_IN_REPOSITORY = Symbol('CHECK_IN_REPOSITORY');

export interface CreateCheckInData {
  id: string;
  organizationId: string;
  eventId: string;
  ticketId: string;
  credentialId: string;
  performedByUserId: string | null;
  result: CheckInResult;
  idempotencyKey: string | null;
  source: CheckInSource;
  notes: string | null;
}

export interface AttendanceByTicketTypeRow {
  ticketTypeId: string;
  ticketTypeName: string;
  totalIssued: number;
  totalAdmitted: number;
}

export interface RecentCheckInRow {
  checkedInAt: Date;
  ticketTypeName: string;
  performedByUserId: string | null;
}

export interface EventAttendanceData {
  byTicketType: AttendanceByTicketTypeRow[];
  recentCheckIns: RecentCheckInRow[];
}

export interface ICheckInRepository {
  /**
   * Find a check-in by idempotency key for replay.
   * Returns null if not found.
   */
  findByIdempotencyKey(key: string): Promise<CheckIn | null>;

  /**
   * Returns true if there is an ADMITTED check-in for the given ticketId.
   * Uses the partial unique index as source of truth.
   */
  existsAdmittedForTicket(ticketId: string): Promise<boolean>;

  /**
   * Persist the check-in record.
   * ON CONFLICT on idempotency_key → returns existing (replay safe).
   * ON CONFLICT on partial unique index (ticket_id WHERE result='ADMITTED') → throws PostgresError 23505.
   */
  createCheckIn(data: CreateCheckInData): Promise<CheckIn>;

  /**
   * Returns attendance metrics for an event, scoped by organization.
   * Returns null if the event does not belong to the organization (cross-tenant guard).
   */
  getEventAttendance(organizationId: string, eventId: string): Promise<EventAttendanceData | null>;
}
