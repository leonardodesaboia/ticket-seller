import { GetFinancialSummaryUseCase } from './get-financial-summary.use-case';
import { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import { SellerBalance } from '../../domain/entities/seller-balance.entity';
import { IFinancialSummaryQueryPort, RawFinancialSummary } from '../ports/financial-summary-query.port';

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

function makeSummaryQuery(summary: RawFinancialSummary): jest.Mocked<IFinancialSummaryQueryPort> {
  return {
    query: jest.fn().mockResolvedValue(summary),
  };
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
      const summaryQuery = makeSummaryQuery({
        grossSales: 50000n,
        platformFees: 5000n,
        refunds: 2000n,
        netSales: 43000n,
      });
      const balanceRepo = makeBalanceRepo(makeBalance());

      const useCase = new GetFinancialSummaryUseCase(summaryQuery, balanceRepo);
      const result = await useCase.execute({ organizationId: 'org-id', from, to });

      expect(summaryQuery.query).toHaveBeenCalledWith({ organizationId: 'org-id', from, to });
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
      const summaryQuery = makeSummaryQuery({
        grossSales: 0n,
        platformFees: 0n,
        refunds: 0n,
        netSales: 0n,
      });
      const balanceRepo = makeBalanceRepo(null);

      const useCase = new GetFinancialSummaryUseCase(summaryQuery, balanceRepo);
      const result = await useCase.execute({ organizationId: 'org-id', from, to });

      expect(result.grossSales).toBe('0');
      expect(result.netSales).toBe('0');
      expect(result.pendingAmount).toBe('0');
    });
  });
});
