import { ListPayoutsUseCase, PayoutItem } from './list-payouts.use-case';
import { IPayoutListQueryPort } from '../ports/payout-list-query.port';

function makePayoutItem(overrides: Partial<PayoutItem> = {}): PayoutItem {
  return {
    id: 'payout-1',
    organizationId: 'org-id',
    recipientId: 'recipient-id',
    amount: '5000',
    currency: 'BRL',
    status: 'PAID',
    provider: 'FAKE',
    externalPayoutId: 'ext-1',
    idempotencyKey: 'key-1',
    failureReason: null,
    requestedAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    succeededAt: new Date('2026-01-15T10:05:00Z').toISOString(),
    failedAt: null,
    createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-01-15T10:05:00Z').toISOString(),
    ...overrides,
  };
}

function makeQueryPort(
  items: PayoutItem[],
  nextCursor: string | null = null,
): jest.Mocked<IPayoutListQueryPort> {
  return {
    query: jest.fn().mockResolvedValue({ data: items, nextCursor }),
  };
}

describe('ListPayoutsUseCase', () => {
  it('returns items with amount as string', async () => {
    const queryPort = makeQueryPort([makePayoutItem()]);
    const useCase = new ListPayoutsUseCase(queryPort);

    const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.amount).toBe('5000');
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor when provided by query port', async () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makePayoutItem({
        id: `payout-${i}`,
        requestedAt: new Date(`2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`).toISOString(),
      }),
    );
    const cursor = Buffer.from('2026-01-20T10:00:00.000Z|payout-19').toString('base64');
    const queryPort = makeQueryPort(items, cursor);
    const useCase = new ListPayoutsUseCase(queryPort);

    const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

    expect(result.nextCursor).not.toBeNull();
    const decoded = Buffer.from(result.nextCursor!, 'base64').toString('utf8');
    expect(decoded).toContain('|');
  });

  it('forwards cursor and limit to the query port', async () => {
    const queryPort = makeQueryPort([]);
    const useCase = new ListPayoutsUseCase(queryPort);
    const cursor = Buffer.from('2026-01-15T10:00:00.000Z|payout-1').toString('base64');

    await useCase.execute({ organizationId: 'org-id', limit: 20, cursor });

    expect(queryPort.query).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-id', cursor, limit: 20 }),
    );
  });
});
