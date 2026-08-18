import {
  ListLedgerTransactionsUseCase,
} from './list-ledger-transactions.use-case';
import { PrismaService } from '../../../../platform/database/prisma.service';

interface RawLedgerRow {
  id: string;
  source_type: string;
  source_id: string;
  description: string | null;
  occurred_at: Date;
  created_at: Date;
  amount: bigint;
  entry_type: string;
  currency: string;
}

function makeRow(overrides: Partial<RawLedgerRow> = {}): RawLedgerRow {
  return {
    id: 'tx-1',
    source_type: 'SALE_RECORDED',
    source_id: 'order-1',
    description: null,
    occurred_at: new Date('2026-01-15T10:00:00Z'),
    created_at: new Date('2026-01-15T10:00:00Z'),
    amount: 5000n,
    entry_type: 'CREDIT',
    currency: 'BRL',
    ...overrides,
  };
}

interface MockPrisma {
  $queryRaw: jest.Mock;
}

function makePrismaWithRows(rows: RawLedgerRow[]): MockPrisma & PrismaService {
  return {
    $queryRaw: jest.fn().mockResolvedValue(rows),
  } as unknown as MockPrisma & PrismaService;
}

describe('ListLedgerTransactionsUseCase', () => {
  describe('returns paginated list without cursor', () => {
    it('returns items and null nextCursor when fewer results than limit', async () => {
      const prisma = makePrismaWithRows([makeRow()]);
      const useCase = new ListLedgerTransactionsUseCase(prisma);

      const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe('tx-1');
      expect(result.data[0]!.amount).toBe('5000');
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('returns nextCursor when results equal limit', () => {
    it('generates cursor from last item occurredAt and id when result.length === limit', async () => {
      const rows = Array.from({ length: 20 }, (_, i) =>
        makeRow({
          id: `tx-${i}`,
          occurred_at: new Date(`2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
        }),
      );
      const prisma = makePrismaWithRows(rows);
      const useCase = new ListLedgerTransactionsUseCase(prisma);

      const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

      expect(result.nextCursor).not.toBeNull();
      // cursor is base64 encoded
      const decoded = Buffer.from(result.nextCursor!, 'base64').toString('utf8');
      expect(decoded).toContain('|');
    });
  });

  describe('decodes cursor correctly', () => {
    it('passes decoded cursor values to query', async () => {
      const prisma = makePrismaWithRows([]);
      const useCase = new ListLedgerTransactionsUseCase(prisma);
      const cursor = Buffer.from('2026-01-15T10:00:00.000Z|tx-1').toString('base64');

      await useCase.execute({ organizationId: 'org-id', limit: 20, cursor });

      expect((prisma as unknown as MockPrisma).$queryRaw).toHaveBeenCalled();
    });
  });
});
