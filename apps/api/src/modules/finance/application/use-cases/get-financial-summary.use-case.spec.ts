import { GetFinancialSummaryUseCase } from './get-financial-summary.use-case';
import { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import { SellerBalance } from '../../domain/entities/seller-balance.entity';
import { PrismaService } from '../../../../platform/database/prisma.service';

function makeBalance(overrides: Partial<SellerBalance> = {}): SellerBalance {
  return {
    id: 'balance-id',
    organizationId: 'org-id',
    pendingAmount: 1000n,
    availableAmount: 5000n,
    reservedAmount: 2000n,
    currency: 'BRL',
    version: 1,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

interface RawSummaryRow {
  gross_sales: bigint;
  platform_fees: bigint;
  refunds: bigint;
  net_sales: bigint;
}

interface MockPrisma {
  $queryRaw: jest.Mock;
}

function makePrismaWithQueryRaw(rows: RawSummaryRow[]): MockPrisma & PrismaService {
  return {
    $queryRaw: jest.fn().mockResolvedValue(rows),
  } as unknown as MockPrisma & PrismaService;
}

function makeBalanceRepo(balance: SellerBalance | null): jest.Mocked<ISellerBalanceRepository> {
  return {
    findByOrg: jest.fn().mockResolvedValue(balance),
    findByOrgForUpdate: jest.fn(),
    upsertIncrementPending: jest.fn(),
    decrementPendingIncrementAvailable: jest.fn(),
    decrementAvailable: jest.fn(),
    decrementPending: jest.fn(),
    incrementReserved: jest.fn(),
    decrementReserved: jest.fn(),
  };
}

describe('GetFinancialSummaryUseCase', () => {
  const from = new Date('2026-01-01');
  const to = new Date('2026-01-31');

  describe('returns aggregated summary with balance', () => {
    it('aggregates gross_sales, platform_fees, refunds and net_sales from ledger_entries', async () => {
      const prisma = makePrismaWithQueryRaw([
        { gross_sales: 50000n, platform_fees: 5000n, refunds: 2000n, net_sales: 43000n },
      ]);
      const balanceRepo = makeBalanceRepo(makeBalance());

      const useCase = new GetFinancialSummaryUseCase(prisma, balanceRepo);
      const result = await useCase.execute({ organizationId: 'org-id', from, to });

      expect((prisma as unknown as MockPrisma).$queryRaw).toHaveBeenCalled();
      expect(result.grossSales).toBe('50000');
      expect(result.platformFees).toBe('5000');
      expect(result.refunds).toBe('2000');
      expect(result.netSales).toBe('43000');
      expect(result.pendingAmount).toBe('1000');
      expect(result.availableAmount).toBe('5000');
      expect(result.reservedAmount).toBe('2000');
      expect(result.currency).toBe('BRL');
    });
  });

  describe('returns zeroes when no ledger entries', () => {
    it('returns all zeroes when rows is empty', async () => {
      const prisma = makePrismaWithQueryRaw([]);
      const balanceRepo = makeBalanceRepo(null);

      const useCase = new GetFinancialSummaryUseCase(prisma, balanceRepo);
      const result = await useCase.execute({ organizationId: 'org-id', from, to });

      expect(result.grossSales).toBe('0');
      expect(result.netSales).toBe('0');
      expect(result.pendingAmount).toBe('0');
    });
  });
});
