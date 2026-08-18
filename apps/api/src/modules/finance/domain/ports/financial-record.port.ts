export const FINANCIAL_RECORD_PORT = Symbol('FINANCIAL_RECORD_PORT');

export interface RecordSaleInput {
  orderId: string;
  organizationId: string;
  grossAmount: bigint;
  currency: string;
  tx?: unknown; // Prisma transaction client
}

export interface IFinancialRecordPort {
  recordSale(input: RecordSaleInput): Promise<void>;
}
