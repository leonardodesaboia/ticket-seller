import { PrismaCheckInRepository } from './prisma-check-in.repository';
import { CheckIn } from '../../domain/check-in.entity';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const EVENT_ID = '22222222-2222-2222-2222-222222222222';
const TICKET_ID = '33333333-3333-3333-3333-333333333333';
const CREDENTIAL_ID = '44444444-4444-4444-4444-444444444444';
const CHECK_IN_ID = '55555555-5555-5555-5555-555555555555';
const IDEMPOTENCY_KEY = 'idem-key-001';

function makeRawCheckInRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CHECK_IN_ID,
    organization_id: ORG_ID,
    event_id: EVENT_ID,
    ticket_id: TICKET_ID,
    credential_id: CREDENTIAL_ID,
    performed_by_user_id: null,
    result: 'ADMITTED',
    idempotency_key: IDEMPOTENCY_KEY,
    checked_in_at: new Date('2024-06-01T10:00:00Z'),
    source: 'SCANNER',
    notes: null,
    ...overrides,
  };
}

function makePrisma(queryRawResult: unknown[] = [], executeRawResult = 1) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(queryRawResult),
    $executeRaw: jest.fn().mockResolvedValue(executeRawResult),
    $transaction: jest.fn(),
  };
}

describe('PrismaCheckInRepository', () => {
  describe('findByIdempotencyKey', () => {
    it('returns null when no check-in matches the idempotency key', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaCheckInRepository(prisma as never);
      const result = await repo.findByIdempotencyKey('missing-key', ORG_ID);
      expect(result).toBeNull();
    });

    it('returns a CheckIn entity when the idempotency key matches', async () => {
      const prisma = makePrisma([makeRawCheckInRow()]);
      const repo = new PrismaCheckInRepository(prisma as never);
      const result = await repo.findByIdempotencyKey(IDEMPOTENCY_KEY, ORG_ID);
      expect(result).toBeInstanceOf(CheckIn);
      expect(result?.id).toBe(CHECK_IN_ID);
      expect(result?.idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(result?.organizationId).toBe(ORG_ID);
    });

    it('enforces cross-tenant isolation by passing organizationId to the query', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaCheckInRepository(prisma as never);

      await repo.findByIdempotencyKey(IDEMPOTENCY_KEY, ORG_ID);

      // Confirm $queryRaw was called — the SQL template includes organizationId via tagged template
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      // The mock call args are the tagged-template TemplateStringsArray + values; the second arg
      // (first interpolated value) is the idempotency key, third is the org UUID.
      const callArgs = prisma.$queryRaw.mock.calls[0] as unknown[];
      // Tagged template literals pass TemplateStringsArray as first arg, then interpolated values.
      // Values: [key, orgId] after the template.
      expect(callArgs[1]).toBe(IDEMPOTENCY_KEY);
      expect(callArgs[2]).toBe(ORG_ID);
    });
  });

  describe('createCheckIn', () => {
    const createData = {
      id: CHECK_IN_ID,
      organizationId: ORG_ID,
      eventId: EVENT_ID,
      ticketId: TICKET_ID,
      credentialId: CREDENTIAL_ID,
      performedByUserId: null,
      result: 'ADMITTED' as const,
      idempotencyKey: IDEMPOTENCY_KEY,
      source: 'SCANNER' as const,
      notes: null,
    };

    it('returns a CheckIn entity on successful insert', async () => {
      const prisma = makePrisma([makeRawCheckInRow()]);
      const repo = new PrismaCheckInRepository(prisma as never);
      const result = await repo.createCheckIn(createData);
      expect(result).toBeInstanceOf(CheckIn);
      expect(result.id).toBe(CHECK_IN_ID);
      expect(result.result).toBe('ADMITTED');
      expect(result.source).toBe('SCANNER');
    });

    it('returns the existing CheckIn when ON CONFLICT on idempotency_key replays (upsert)', async () => {
      // ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
      // always returns the row (either new or existing), so the repo returns the entity.
      const existingRow = makeRawCheckInRow({ id: 'existing-id' });
      const prisma = makePrisma([existingRow]);
      const repo = new PrismaCheckInRepository(prisma as never);
      const result = await repo.createCheckIn(createData);
      expect(result).toBeInstanceOf(CheckIn);
      expect(result.id).toBe('existing-id');
    });

    it('throws when no row is returned by the INSERT (unexpected guard)', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaCheckInRepository(prisma as never);
      await expect(repo.createCheckIn(createData)).rejects.toThrow('createCheckIn: no row returned');
    });

    it('maps all fields correctly including nullable performedByUserId and notes', async () => {
      const row = makeRawCheckInRow({
        performed_by_user_id: '66666666-6666-6666-6666-666666666666',
        notes: 'VIP entry',
      });
      const prisma = makePrisma([row]);
      const repo = new PrismaCheckInRepository(prisma as never);
      const result = await repo.createCheckIn({
        ...createData,
        performedByUserId: '66666666-6666-6666-6666-666666666666',
        notes: 'VIP entry',
      });
      expect(result.performedByUserId).toBe('66666666-6666-6666-6666-666666666666');
      expect(result.notes).toBe('VIP entry');
    });
  });
});
