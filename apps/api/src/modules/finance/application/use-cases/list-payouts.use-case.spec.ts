import { ListPayoutsUseCase } from './list-payouts.use-case';
import { PrismaService } from '../../../../platform/database/prisma.service';

interface RawPayoutRow {
  id: string;
  organization_id: string;
  recipient_id: string;
  amount: bigint;
  currency: string;
  status: string;
  provider: string;
  external_payout_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  requested_at: Date;
  succeeded_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function makePayoutRow(overrides: Partial<RawPayoutRow> = {}): RawPayoutRow {
  return {
    id: 'payout-1',
    organization_id: 'org-id',
    recipient_id: 'recipient-id',
    amount: 5000n,
    currency: 'BRL',
    status: 'PAID',
    provider: 'FAKE',
    external_payout_id: 'ext-1',
    idempotency_key: 'key-1',
    failure_reason: null,
    requested_at: new Date('2026-01-15T10:00:00Z'),
    succeeded_at: new Date('2026-01-15T10:05:00Z'),
    failed_at: null,
    created_at: new Date('2026-01-15T10:00:00Z'),
    updated_at: new Date('2026-01-15T10:05:00Z'),
    ...overrides,
  };
}

interface MockPrisma {
  $queryRaw: jest.Mock;
}

function makePrismaWithRows(rows: RawPayoutRow[]): MockPrisma & PrismaService {
  return {
    $queryRaw: jest.fn().mockResolvedValue(rows),
  } as unknown as MockPrisma & PrismaService;
}

describe('ListPayoutsUseCase', () => {
  it('returns items with amount as string', async () => {
    const prisma = makePrismaWithRows([makePayoutRow()]);
    const useCase = new ListPayoutsUseCase(prisma);

    const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.amount).toBe('5000');
    expect(result.nextCursor).toBeNull();
  });

  it('generates nextCursor when results equal limit', async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makePayoutRow({
        id: `payout-${i}`,
        requested_at: new Date(`2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      }),
    );
    const prisma = makePrismaWithRows(rows);
    const useCase = new ListPayoutsUseCase(prisma);

    const result = await useCase.execute({ organizationId: 'org-id', limit: 20 });

    expect(result.nextCursor).not.toBeNull();
    const decoded = Buffer.from(result.nextCursor!, 'base64').toString('utf8');
    expect(decoded).toContain('|');
  });

  it('uses cursor in query when provided', async () => {
    const prisma = makePrismaWithRows([]);
    const useCase = new ListPayoutsUseCase(prisma);
    const cursor = Buffer.from('2026-01-15T10:00:00.000Z|payout-1').toString('base64');

    await useCase.execute({ organizationId: 'org-id', limit: 20, cursor });

    expect((prisma as unknown as MockPrisma).$queryRaw).toHaveBeenCalled();
  });
});
