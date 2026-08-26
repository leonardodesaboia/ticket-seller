import { PrismaTicketCredentialRepository } from './prisma-ticket-credential.repository';
import { TicketCredential } from '../../domain/ticket-credential.entity';

const TOKEN_HASH = 'a'.repeat(64);
const NEW_TOKEN_HASH = 'b'.repeat(64);
const TICKET_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CRED_ID = '33333333-3333-3333-3333-333333333333';

function makeRawRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CRED_ID,
    ticket_id: TICKET_ID,
    organization_id: ORG_ID,
    token_hash: TOKEN_HASH,
    status: 'ACTIVE',
    version: 1,
    issued_at: new Date('2024-01-01T00:00:00Z'),
    revoked_at: null,
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

describe('PrismaTicketCredentialRepository', () => {
  describe('findActiveByTicketId', () => {
    it('returns null when no active credential exists', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.findActiveByTicketId(TICKET_ID, ORG_ID);
      expect(result).toBeNull();
    });

    it('returns a TicketCredential entity when an active credential exists', async () => {
      const prisma = makePrisma([makeRawRow()]);
      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.findActiveByTicketId(TICKET_ID, ORG_ID);
      expect(result).toBeInstanceOf(TicketCredential);
      expect(result?.id).toBe(CRED_ID);
      expect(result?.ticketId).toBe(TICKET_ID);
      expect(result?.organizationId).toBe(ORG_ID);
      expect(result?.status).toBe('ACTIVE');
      expect(result?.tokenHash).toBe(TOKEN_HASH);
      expect(result?.version).toBe(1);
    });
  });

  describe('findByTokenHash', () => {
    it('returns null when no credential matches the token hash', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.findByTokenHash('c'.repeat(64), ORG_ID);
      expect(result).toBeNull();
    });

    it('returns a TicketCredential entity when token hash matches', async () => {
      const prisma = makePrisma([makeRawRow()]);
      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.findByTokenHash(TOKEN_HASH, ORG_ID);
      expect(result).toBeInstanceOf(TicketCredential);
      expect(result?.tokenHash).toBe(TOKEN_HASH);
      expect(result?.organizationId).toBe(ORG_ID);
    });
  });

  describe('createIfNoneActive', () => {
    const createData = {
      id: CRED_ID,
      ticketId: TICKET_ID,
      organizationId: ORG_ID,
      tokenHash: TOKEN_HASH,
      version: 1,
    };

    it('returns the created TicketCredential on success', async () => {
      const prisma = makePrisma([makeRawRow()]);
      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.createIfNoneActive(createData);
      expect(result).toBeInstanceOf(TicketCredential);
      expect(result?.id).toBe(CRED_ID);
      expect(result?.status).toBe('ACTIVE');
    });

    it('returns null when ON CONFLICT DO NOTHING prevents insert (existing active)', async () => {
      // ON CONFLICT DO NOTHING → 0 rows returned
      const prisma = makePrisma([]);
      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.createIfNoneActive(createData);
      expect(result).toBeNull();
    });
  });

  describe('rotateCredential', () => {
    const newData = {
      id: '44444444-4444-4444-4444-444444444444',
      ticketId: TICKET_ID,
      organizationId: ORG_ID,
      tokenHash: NEW_TOKEN_HASH,
      version: 2,
    };

    function makeTx(newRows: unknown[] = []) {
      return {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue(newRows),
      };
    }

    it('revokes existing credential, inserts new one, and returns the new TicketCredential', async () => {
      const newRow = makeRawRow({
        id: newData.id,
        token_hash: NEW_TOKEN_HASH,
        status: 'ACTIVE',
        version: 2,
      });
      const tx = makeTx([newRow]);
      const prisma = {
        $transaction: jest
          .fn()
          .mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      };

      const repo = new PrismaTicketCredentialRepository(prisma as never);
      const result = await repo.rotateCredential(TICKET_ID, ORG_ID, newData);

      expect(result).toBeInstanceOf(TicketCredential);
      expect(result.tokenHash).toBe(NEW_TOKEN_HASH);
      expect(result.version).toBe(2);
      // Verify that both UPDATE and INSERT ran inside the transaction
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('uses a $transaction so UPDATE and INSERT are atomic', async () => {
      const tx = makeTx([makeRawRow({ token_hash: NEW_TOKEN_HASH, version: 2 })]);
      const prisma = {
        $transaction: jest
          .fn()
          .mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      };

      const repo = new PrismaTicketCredentialRepository(prisma as never);
      await repo.rotateCredential(TICKET_ID, ORG_ID, newData);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws when the INSERT returns no rows (insert failed guard)', async () => {
      const tx = makeTx([]); // empty → insert failed
      const prisma = {
        $transaction: jest
          .fn()
          .mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      };

      const repo = new PrismaTicketCredentialRepository(prisma as never);
      await expect(repo.rotateCredential(TICKET_ID, ORG_ID, newData)).rejects.toThrow(
        'rotateCredential: insert failed',
      );
    });
  });
});
