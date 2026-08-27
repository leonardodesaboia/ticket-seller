import {
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import {
  IFinancialSummaryQueryPort,
} from '../ports/financial-summary-query.port';

export interface GetFinancialSummaryInput {
  organizationId: string;
  from: Date;
  to: Date;
}

export interface FinancialSummaryResult {
  grossSales: string;
  platformFees: string;
  refunds: string;
  netSales: string;
  pendingAmount: string;
  availableAmount: string;
  reservedAmount: string;
  currency: string;
}

export class GetFinancialSummaryUseCase {
  constructor(
    private readonly financialSummaryQuery: IFinancialSummaryQueryPort,
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
  ) {}

  async execute(input: GetFinancialSummaryInput): Promise<FinancialSummaryResult> {
    const { organizationId, from, to } = input;

    const summary = await this.financialSummaryQuery.query({ organizationId, from, to });

    const balance = await this.sellerBalanceRepo.findByOrg(organizationId);

    return {
      grossSales: summary.grossSales.toString(),
      platformFees: summary.platformFees.toString(),
      refunds: summary.refunds.toString(),
      netSales: summary.netSales.toString(),
      pendingAmount: (balance?.pendingAmount ?? 0n).toString(),
      availableAmount: (balance?.availableAmount ?? 0n).toString(),
      reservedAmount: (balance?.reservedAmount ?? 0n).toString(),
      currency: balance?.currency ?? 'BRL',
    };
  }
}
