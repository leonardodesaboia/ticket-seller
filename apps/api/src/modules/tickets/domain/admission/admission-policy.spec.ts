import { AdmissionContext } from './admission-context';
import { AdmissionPolicy } from './admission-policy';

const policy = new AdmissionPolicy();

/** Contexto base totalmente válido — cada teste muda apenas o campo relevante. */
const validCtx: AdmissionContext = {
  tokenHash: 'a'.repeat(64),
  targetEventId: 'evt-1',
  credential: { status: 'ACTIVE', ticketId: 'tkt-1' },
  ticket: { status: 'ACTIVE', eventId: 'evt-1', transferPending: false },
  eventStatus: 'PUBLISHED',
  alreadyAdmitted: false,
};

function ctx(overrides: Partial<AdmissionContext>): AdmissionContext {
  return { ...validCtx, ...overrides };
}

// ---------------------------------------------------------------------------
// VALID — caminho feliz
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — VALID', () => {
  it('retorna VALID quando todos os campos estão corretos', () => {
    const result = policy.evaluate(validCtx);
    expect(result.code).toBe('VALID');
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// INVALID_CREDENTIAL
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — INVALID_CREDENTIAL', () => {
  it('retorna INVALID_CREDENTIAL quando credential é null', () => {
    const result = policy.evaluate(ctx({ credential: null }));
    expect(result.code).toBe('INVALID_CREDENTIAL');
    expect(result.allowed).toBe(false);
  });

  it('retorna INVALID_CREDENTIAL quando credential.status é REVOKED', () => {
    const result = policy.evaluate(
      ctx({ credential: { status: 'REVOKED', ticketId: 'tkt-1' } }),
    );
    expect(result.code).toBe('INVALID_CREDENTIAL');
    expect(result.allowed).toBe(false);
  });

  it('retorna INVALID_CREDENTIAL quando credential existe mas ticket é null (inconsistência)', () => {
    const result = policy.evaluate(ctx({ ticket: null }));
    expect(result.code).toBe('INVALID_CREDENTIAL');
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TICKET_CANCELLED
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — TICKET_CANCELLED', () => {
  it('retorna TICKET_CANCELLED quando ticket.status é CANCELLED', () => {
    const result = policy.evaluate(
      ctx({ ticket: { status: 'CANCELLED', eventId: 'evt-1', transferPending: false } }),
    );
    expect(result.code).toBe('TICKET_CANCELLED');
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WRONG_EVENT
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — WRONG_EVENT', () => {
  it('retorna WRONG_EVENT quando ticket.eventId é diferente de targetEventId', () => {
    const result = policy.evaluate(
      ctx({ ticket: { status: 'ACTIVE', eventId: 'evt-OTHER', transferPending: false } }),
    );
    expect(result.code).toBe('WRONG_EVENT');
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EVENT_NOT_ACTIVE
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — EVENT_NOT_ACTIVE', () => {
  it.each([['DRAFT'], ['PAUSED'], ['CANCELLED'], ['COMPLETED'], ['ARCHIVED'], ['UNKNOWN']])(
    'retorna EVENT_NOT_ACTIVE quando eventStatus é "%s"',
    (status) => {
      const result = policy.evaluate(ctx({ eventStatus: status }));
      expect(result.code).toBe('EVENT_NOT_ACTIVE');
      expect(result.allowed).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// TRANSFER_PENDING
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — TRANSFER_PENDING', () => {
  it('retorna TRANSFER_PENDING quando transferPending é true', () => {
    const result = policy.evaluate(
      ctx({ ticket: { status: 'ACTIVE', eventId: 'evt-1', transferPending: true } }),
    );
    expect(result.code).toBe('TRANSFER_PENDING');
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ALREADY_CHECKED_IN
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — ALREADY_CHECKED_IN', () => {
  it('retorna ALREADY_CHECKED_IN quando alreadyAdmitted é true', () => {
    const result = policy.evaluate(ctx({ alreadyAdmitted: true }));
    expect(result.code).toBe('ALREADY_CHECKED_IN');
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Prioridade de avaliação (a ordem importa)
// ---------------------------------------------------------------------------

describe('AdmissionPolicy — prioridade de avaliação', () => {
  it('INVALID_CREDENTIAL tem prioridade sobre TICKET_CANCELLED', () => {
    const result = policy.evaluate(
      ctx({
        credential: null,
        ticket: { status: 'CANCELLED', eventId: 'evt-1', transferPending: false },
      }),
    );
    expect(result.code).toBe('INVALID_CREDENTIAL');
  });

  it('INVALID_CREDENTIAL tem prioridade sobre WRONG_EVENT', () => {
    const result = policy.evaluate(
      ctx({
        credential: { status: 'REVOKED', ticketId: 'tkt-1' },
        ticket: { status: 'ACTIVE', eventId: 'evt-OTHER', transferPending: false },
      }),
    );
    expect(result.code).toBe('INVALID_CREDENTIAL');
  });

  it('INVALID_CREDENTIAL tem prioridade sobre ALREADY_CHECKED_IN', () => {
    const result = policy.evaluate(ctx({ credential: null, alreadyAdmitted: true }));
    expect(result.code).toBe('INVALID_CREDENTIAL');
  });

  it('TICKET_CANCELLED tem prioridade sobre WRONG_EVENT', () => {
    const result = policy.evaluate(
      ctx({
        ticket: { status: 'CANCELLED', eventId: 'evt-OTHER', transferPending: false },
      }),
    );
    expect(result.code).toBe('TICKET_CANCELLED');
  });

  it('TICKET_CANCELLED tem prioridade sobre EVENT_NOT_ACTIVE', () => {
    const result = policy.evaluate(
      ctx({
        ticket: { status: 'CANCELLED', eventId: 'evt-1', transferPending: false },
        eventStatus: 'DRAFT',
      }),
    );
    expect(result.code).toBe('TICKET_CANCELLED');
  });

  it('WRONG_EVENT tem prioridade sobre EVENT_NOT_ACTIVE', () => {
    const result = policy.evaluate(
      ctx({
        ticket: { status: 'ACTIVE', eventId: 'evt-OTHER', transferPending: false },
        eventStatus: 'DRAFT',
      }),
    );
    expect(result.code).toBe('WRONG_EVENT');
  });

  it('EVENT_NOT_ACTIVE tem prioridade sobre TRANSFER_PENDING', () => {
    const result = policy.evaluate(
      ctx({
        ticket: { status: 'ACTIVE', eventId: 'evt-1', transferPending: true },
        eventStatus: 'DRAFT',
      }),
    );
    expect(result.code).toBe('EVENT_NOT_ACTIVE');
  });

  it('TRANSFER_PENDING tem prioridade sobre ALREADY_CHECKED_IN', () => {
    const result = policy.evaluate(
      ctx({
        ticket: { status: 'ACTIVE', eventId: 'evt-1', transferPending: true },
        alreadyAdmitted: true,
      }),
    );
    expect(result.code).toBe('TRANSFER_PENDING');
  });

  it('ALREADY_CHECKED_IN tem prioridade sobre VALID (caminho feliz é o último)', () => {
    const result = policy.evaluate(ctx({ alreadyAdmitted: true }));
    expect(result.code).toBe('ALREADY_CHECKED_IN');
    expect(result.allowed).toBe(false);
  });
});
