import { PrismaTicketTransferRepository } from './prisma-ticket-transfer.repository';
import {
  TransferAlreadyAcceptedError,
  TransferExpiredError,
  TicketAlreadyAdmittedError,
} from '../../domain/ticket-transfer.errors';

function makeRawRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'transfer-id',
    ticket_id: 'ticket-id',
    organization_id: 'org-id',
    claim_token_hash: 'a'.repeat(64),
    status: 'PENDING',
    expires_at: new Date(Date.now() + 3_600_000), // 1h from now
    accepted_at: null,
    cancelled_at: null,
    created_at: new Date(),
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

describe('PrismaTicketTransferRepository', () => {
  describe('findByClaimTokenHash', () => {
    it('returns null when no row found', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaTicketTransferRepository(prisma as never);
      const result = await repo.findByClaimTokenHash('unknown-hash');
      expect(result).toBeNull();
    });

    it('returns a TicketTransfer entity when row exists', async () => {
      const knownHash = 'b'.repeat(64);
      const row = makeRawRow({ claim_token_hash: knownHash });
      const prisma = makePrisma([row]);
      const repo = new PrismaTicketTransferRepository(prisma as never);
      const result = await repo.findByClaimTokenHash(knownHash);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('transfer-id');
      expect(result?.status).toBe('PENDING');
    });
  });

  describe('findPendingByTicketId', () => {
    it('returns null when no pending transfer found', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaTicketTransferRepository(prisma as never);
      const result = await repo.findPendingByTicketId('ticket-id', 'org-id');
      expect(result).toBeNull();
    });

    it('returns entity when pending transfer found', async () => {
      const prisma = makePrisma([makeRawRow()]);
      const repo = new PrismaTicketTransferRepository(prisma as never);
      const result = await repo.findPendingByTicketId('ticket-id', 'org-id');
      expect(result?.ticketId).toBe('ticket-id');
    });
  });

  describe('cancel', () => {
    it('resolves when the UPDATE affects 1 row (happy path)', async () => {
      const prisma = makePrisma([], 1);
      const repo = new PrismaTicketTransferRepository(prisma as never);
      await expect(repo.cancel('transfer-id')).resolves.toBeUndefined();
    });

    it('throws TransferAlreadyAcceptedError when UPDATE affects 0 rows', async () => {
      const prisma = makePrisma([], 0);
      const repo = new PrismaTicketTransferRepository(prisma as never);
      await expect(repo.cancel('transfer-id')).rejects.toBeInstanceOf(TransferAlreadyAcceptedError);
    });
  });

  describe('acceptAtomically', () => {
    const params = {
      ticketId: 'ticket-id',
      transferId: 'transfer-id',
      organizationId: 'org-id',
    };

    function makeTx(overrides: {
      ticketRows?: object[];
      transferRows?: object[];
      admittedRows?: object[];
      versionRows?: object[];
    } = {}) {
      return {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce(overrides.ticketRows ?? [{ id: 'ticket-id' }])
          .mockResolvedValueOnce(
            overrides.transferRows ?? [
              { status: 'PENDING', expires_at: new Date(Date.now() + 3_600_000) },
            ],
          )
          .mockResolvedValueOnce(overrides.admittedRows ?? [])
          .mockResolvedValueOnce(overrides.versionRows ?? [{ max_version: 0 }]),
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
    }

    function withTx(tx: ReturnType<typeof makeTx>) {
      return {
        $transaction: jest.fn().mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      };
    }

    it('throws TransferAlreadyAcceptedError when transfer status is not PENDING', async () => {
      const tx = makeTx({ transferRows: [{ status: 'ACCEPTED', expires_at: new Date(Date.now() + 3_600_000) }] });
      const repo = new PrismaTicketTransferRepository(withTx(tx) as never);
      await expect(repo.acceptAtomically(params)).rejects.toBeInstanceOf(TransferAlreadyAcceptedError);
    });

    it('throws TransferExpiredError when expires_at is in the past', async () => {
      const tx = makeTx({ transferRows: [{ status: 'PENDING', expires_at: new Date(Date.now() - 1000) }] });
      const repo = new PrismaTicketTransferRepository(withTx(tx) as never);
      await expect(repo.acceptAtomically(params)).rejects.toBeInstanceOf(TransferExpiredError);
    });

    it('throws TicketAlreadyAdmittedError when ticket has been admitted', async () => {
      const tx = makeTx({ admittedRows: [{ id: 'checkin-id' }] });
      const repo = new PrismaTicketTransferRepository(withTx(tx) as never);
      await expect(repo.acceptAtomically(params)).rejects.toBeInstanceOf(TicketAlreadyAdmittedError);
    });

    it('returns a 64-char hex credential token on success', async () => {
      const tx = makeTx();
      const repo = new PrismaTicketTransferRepository(withTx(tx) as never);
      const token = await repo.acceptAtomically(params);
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes as hex
    });
  });
});
