import * as crypto from 'node:crypto';
import { PerformCheckInUseCase } from './perform-check-in.use-case';
import { ICheckInRepository } from '../../domain/ports/check-in-repository.port';
import { IEventAccessForCheckInPort } from '../ports/event-access.port';
import { ITicketAccessForCheckInPort } from '../ports/ticket-access.port';
import { CheckIn } from '../../domain/check-in.entity';

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return new CheckIn({
    id: 'check-in-id',
    organizationId: 'org-id',
    eventId: 'event-id',
    ticketId: 'ticket-id',
    credentialId: 'cred-id',
    performedByUserId: null,
    result: 'ADMITTED',
    idempotencyKey: null,
    checkedInAt: new Date('2026-01-01T10:00:00Z'),
    source: 'SCANNER',
    notes: null,
    ...overrides,
  });
}

function makeRepoMock(overrides: Partial<ICheckInRepository> = {}): ICheckInRepository {
  return {
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    existsAdmittedForTicket: jest.fn().mockResolvedValue(false),
    createCheckIn: jest.fn().mockResolvedValue(makeCheckIn()),
    ...overrides,
  };
}

function makeEventAccessMock(overrides: Partial<IEventAccessForCheckInPort> = {}): IEventAccessForCheckInPort {
  return {
    findEventForCheckIn: jest.fn().mockResolvedValue({
      id: 'event-id',
      organizationId: 'org-id',
      status: 'PUBLISHED',
    }),
    ...overrides,
  };
}

function makeTicketAccessMock(overrides: Partial<ITicketAccessForCheckInPort> = {}): ITicketAccessForCheckInPort {
  return {
    findTicketByCredentialHash: jest.fn().mockResolvedValue({
      ticketId: 'ticket-id',
      ticketEventId: 'event-id',
      ticketStatus: 'ACTIVE',
      credentialId: 'cred-id',
      credentialStatus: 'ACTIVE',
      transferPending: false,
    }),
    ...overrides,
  };
}

function buildUseCase(
  repo: ICheckInRepository,
  eventAccess: IEventAccessForCheckInPort,
  ticketAccess: ITicketAccessForCheckInPort,
): PerformCheckInUseCase {
  const useCase = new PerformCheckInUseCase(repo, eventAccess, ticketAccess);
  return useCase;
}

const VALID_TOKEN = 'a'.repeat(64);
const BASE_INPUT = {
  organizationId: 'org-id',
  eventId: 'event-id',
  credentialToken: VALID_TOKEN,
  idempotencyKey: null,
  performedByUserId: null,
  notes: null,
};

describe('PerformCheckInUseCase', () => {
  it('1. Replay via idempotency key returns original result without re-executing policy', async () => {
    const existingCheckIn = makeCheckIn({
      result: 'ADMITTED',
      idempotencyKey: 'test-key-123',
      checkedInAt: new Date('2026-01-01T10:00:00Z'),
    });
    const repo = makeRepoMock({
      findByIdempotencyKey: jest.fn().mockResolvedValue(existingCheckIn),
    });
    const eventAccess = makeEventAccessMock();
    const ticketAccess = makeTicketAccessMock();
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    const result = await useCase.execute({ ...BASE_INPUT, idempotencyKey: 'test-key-123' });

    expect(result.decision).toBe('ADMITTED');
    expect(result.allowed).toBe(true);
    expect(result.checkedInAt).toBe('2026-01-01T10:00:00.000Z');
    // Should NOT call event or ticket access for replay
    expect(eventAccess.findEventForCheckIn).not.toHaveBeenCalled();
    expect(ticketAccess.findTicketByCredentialHash).not.toHaveBeenCalled();
  });

  it('2. ADMITTED when all conditions are valid', async () => {
    const admittedCheckIn = makeCheckIn({ result: 'ADMITTED', checkedInAt: new Date() });
    const repo = makeRepoMock({
      createCheckIn: jest.fn().mockResolvedValue(admittedCheckIn),
    });
    const eventAccess = makeEventAccessMock();
    const ticketAccess = makeTicketAccessMock();
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    const result = await useCase.execute(BASE_INPUT);

    expect(result.decision).toBe('ADMITTED');
    expect(result.allowed).toBe(true);
    expect(result.checkedInAt).toBeTruthy();
  });

  it('3. INVALID_CREDENTIAL when no ticket found — does NOT persist check-in', async () => {
    const repo = makeRepoMock();
    const eventAccess = makeEventAccessMock();
    const ticketAccess = makeTicketAccessMock({
      findTicketByCredentialHash: jest.fn().mockResolvedValue(null),
    });
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    const result = await useCase.execute(BASE_INPUT);

    expect(result.decision).toBe('INVALID_CREDENTIAL');
    expect(result.allowed).toBe(false);
    expect(result.checkedInAt).toBeNull();
    // Must NOT call createCheckIn since there is no valid FK
    expect(repo.createCheckIn).not.toHaveBeenCalled();
  });

  it('4. ALREADY_CHECKED_IN when existsAdmittedForTicket is true', async () => {
    const repo = makeRepoMock({
      existsAdmittedForTicket: jest.fn().mockResolvedValue(true),
      createCheckIn: jest.fn().mockResolvedValue(makeCheckIn({ result: 'ALREADY_CHECKED_IN' })),
    });
    const eventAccess = makeEventAccessMock();
    const ticketAccess = makeTicketAccessMock();
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    const result = await useCase.execute(BASE_INPUT);

    expect(result.decision).toBe('ALREADY_CHECKED_IN');
    expect(result.allowed).toBe(false);
  });

  it('5. ALREADY_CHECKED_IN when createCheckIn throws Postgres 23505', async () => {
    const pgError = Object.assign(new Error('unique violation'), { code: '23505' });
    const repo = makeRepoMock({
      createCheckIn: jest.fn().mockRejectedValue(pgError),
    });
    const eventAccess = makeEventAccessMock();
    const ticketAccess = makeTicketAccessMock();
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    const result = await useCase.execute(BASE_INPUT);

    expect(result.decision).toBe('ALREADY_CHECKED_IN');
    expect(result.allowed).toBe(false);
    expect(result.checkedInAt).toBeNull();
  });

  it('6. Response does not contain tokenHash', async () => {
    const repo = makeRepoMock();
    const eventAccess = makeEventAccessMock();
    const ticketAccess = makeTicketAccessMock();
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    const result = await useCase.execute(BASE_INPUT);

    expect(result).not.toHaveProperty('tokenHash');
    expect(result).not.toHaveProperty('credentialId');
    expect(result).not.toHaveProperty('ticketId');
    expect(result).not.toHaveProperty('orderId');
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(['decision', 'allowed', 'checkedInAt']),
    );
  });

  it('token is hashed — raw token is not passed to adapter', async () => {
    const repo = makeRepoMock();
    const eventAccess = makeEventAccessMock();
    const findTicketByCredentialHash = jest.fn().mockResolvedValue(null);
    const ticketAccess = makeTicketAccessMock({ findTicketByCredentialHash });
    const useCase = buildUseCase(repo, eventAccess, ticketAccess);

    await useCase.execute(BASE_INPUT);

    const calledWith = (findTicketByCredentialHash as jest.Mock).mock.calls[0][0] as string;
    // Should be 64-hex SHA256, not the raw token
    expect(calledWith).toMatch(/^[0-9a-f]{64}$/);
    expect(calledWith).not.toBe(VALID_TOKEN);
    const expectedHash = crypto.createHash('sha256').update(VALID_TOKEN).digest('hex');
    expect(calledWith).toBe(expectedHash);
  });
});
