import {
  ListLedgerTransactionsUseCase,
  LedgerTransactionItem,
} from './list-ledger-transactions.use-case';
import { ILedgerTransactionListQueryPort } from '../ports/ledger-transaction-list-query.port';

function makeItem(overrides: Partial<LedgerTransactionItem> = {}): LedgerTransactionItem {
  return {
    id: 'tx-1',
    sourceType: 'SALE_RECORDED',
    sourceId: 'order-1',
    description: null,
    occurredAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    amount: '5000',
    entryType: 'CREDIT',
    currency: 'BRL',
    ...overrides,
  };
}

function makeQueryPort(
  items: LedgerTransactionItem[],
  nextCursor: string | null = null,
): jest.Mocked<ILedgerTransactionListQueryPort> {
  return {
    query: jest.fn().mockResolvedValue({ data: items, nextCursor }),
  };
}

describe('ListLedgerTransactionsUseCase', () => {
  describe('returns paginated list without cursor', () => {
    it('returns items and null nextCursor when fewer results than limit', async () => {
      const queryPort = makeQueryPort([makeItem()]);
      const useCase = new ListLedgerTransactionsUseCase(queryPort);

      const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe('tx-1');
      expect(result.data[0]!.amount).toBe('5000');
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('returns nextCursor when results equal limit', () => {
    it('returns nextCursor when provided by query port', async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        makeItem({
          id: `tx-${i}`,
          occurredAt: new Date(`2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`).toISOString(),
        }),
      );
      const cursor = Buffer.from('2026-01-20T10:00:00.000Z|tx-19').toString('base64');
      const queryPort = makeQueryPort(items, cursor);
      const useCase = new ListLedgerTransactionsUseCase(queryPort);

      const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

      expect(result.nextCursor).not.toBeNull();
      const decoded = Buffer.from(result.nextCursor!, 'base64').toString('utf8');
      expect(decoded).toContain('|');
    });
  });

  describe('forwards cursor to query port', () => {
    it('passes cursor and limit to the query port', async () => {
      const queryPort = makeQueryPort([]);
      const useCase = new ListLedgerTransactionsUseCase(queryPort);
      const cursor = Buffer.from('2026-01-15T10:00:00.000Z|tx-1').toString('base64');

      await useCase.execute({ organizationId: 'org-id', limit: 20, cursor });

      expect(queryPort.query).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-id', cursor, limit: 20 }),
      );
    });
  });
});
