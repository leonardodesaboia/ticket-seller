import * as crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { AdmissionPolicy } from '../../../tickets/contracts/admission.contract';
import {
  ICheckInRepository,
} from '../../domain/ports/check-in-repository.port';
import { CheckInResult } from '../../domain/check-in.entity';
import {
  IEventAccessForCheckInPort,
} from '../ports/event-access.port';
import {
  ITicketAccessForCheckInPort,
} from '../ports/ticket-access.port';

export interface PerformCheckInInput {
  organizationId: string;
  eventId: string;
  credentialToken: string;
  idempotencyKey: string | null;
  performedByUserId: string | null;
  notes: string | null;
}

export interface PerformCheckInOutput {
  decision: CheckInResult;
  allowed: boolean;
  checkedInAt: string | null;
}

export class PerformCheckInUseCase {
  private readonly policy = new AdmissionPolicy();

  constructor(
    private readonly checkInRepo: ICheckInRepository,
    private readonly eventAccess: IEventAccessForCheckInPort,
    private readonly ticketAccess: ITicketAccessForCheckInPort,
  ) {}

  async execute(input: PerformCheckInInput): Promise<PerformCheckInOutput> {
    // Step 1: Replay via idempotency key
    if (input.idempotencyKey) {
      const existing = await this.checkInRepo.findByIdempotencyKey(input.idempotencyKey, input.organizationId);
      if (existing) {
        return {
          decision: existing.result,
          allowed: existing.result === 'ADMITTED',
          checkedInAt: existing.result === 'ADMITTED' ? existing.checkedInAt.toISOString() : null,
        };
      }
    }

    // Step 2: Hash the credential token
    const tokenHash = crypto.createHash('sha256').update(input.credentialToken).digest('hex');

    // Step 3: Find ticket data by credential hash
    const ticketData = await this.ticketAccess.findTicketByCredentialHash(
      tokenHash,
      input.organizationId,
    );

    // Step 4: Find event
    const event = await this.eventAccess.findEventForCheckIn(
      input.eventId,
      input.organizationId,
    );

    // Step 5: Check if already admitted
    const alreadyAdmitted =
      ticketData != null
        ? await this.checkInRepo.existsAdmittedForTicket(ticketData.ticketId)
        : false;

    // Step 6: Evaluate admission policy
    const decision = this.policy.evaluate({
      tokenHash,
      targetEventId: input.eventId,
      credential: ticketData
        ? { status: ticketData.credentialStatus, ticketId: ticketData.ticketId }
        : null,
      ticket: ticketData
        ? {
            status: ticketData.ticketStatus,
            eventId: ticketData.ticketEventId,
            transferPending: ticketData.transferPending,
          }
        : null,
      eventStatus: event?.status ?? 'UNKNOWN',
      alreadyAdmitted,
    });

    // Step 7: Persist if we have a valid ticket reference (INVALID_CREDENTIAL without ticket → no FK)
    if (ticketData) {
      // Map VALID → ADMITTED for the stored result (the DB constraint uses ADMITTED, not VALID)
      const storedResult: CheckInResult = decision.code === 'VALID' ? 'ADMITTED' : decision.code;

      try {
        const checkIn = await this.checkInRepo.createCheckIn({
          id: randomUUID(),
          organizationId: input.organizationId,
          eventId: input.eventId,
          ticketId: ticketData.ticketId,
          credentialId: ticketData.credentialId,
          performedByUserId: input.performedByUserId,
          result: storedResult,
          idempotencyKey: input.idempotencyKey,
          source: 'SCANNER',
          notes: input.notes,
        });

        return {
          decision: storedResult,
          allowed: decision.allowed,
          checkedInAt: decision.allowed ? checkIn.checkedInAt.toISOString() : null,
        };
      } catch (err: unknown) {
        // Step 8: Handle PostgresError 23505 from partial unique index
        if (isUniqueViolation(err)) {
          return {
            decision: 'ALREADY_CHECKED_IN',
            allowed: false,
            checkedInAt: null,
          };
        }
        throw err;
      }
    }

    // INVALID_CREDENTIAL without a ticket: do not persist
    // decision.code is never VALID here (VALID requires a ticket)
    return {
      decision: decision.code as CheckInResult,
      allowed: decision.allowed,
      checkedInAt: null,
    };
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  // Prisma wraps the PG error — code is on meta or on the error itself
  if (e['code'] === '23505') return true;
  const meta = e['meta'] as Record<string, unknown> | undefined;
  if (meta && meta['code'] === '23505') return true;
  // PrismaClientKnownRequestError with P2002 is for Prisma-managed unique
  // but for raw $queryRaw the underlying pg error code is exposed directly
  const cause = e['cause'] as Record<string, unknown> | undefined;
  if (cause && cause['code'] === '23505') return true;
  return false;
}
