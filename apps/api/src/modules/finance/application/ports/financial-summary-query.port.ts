export const FINANCIAL_SUMMARY_QUERY_PORT = Symbol('IFinancialSummaryQueryPort');

export interface RawFinancialSummary {
  grossSales: bigint;
  platformFees: bigint;
  refunds: bigint;
  netSales: bigint;
}

export interface IFinancialSummaryQueryPort {
  query(params: { organizationId: string; from: Date; to: Date }): Promise<RawFinancialSummary>;
}
