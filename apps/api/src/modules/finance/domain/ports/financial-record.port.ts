export const FINANCIAL_RECORD_PORT = Symbol('FINANCIAL_RECORD_PORT');

export interface RecordSaleInput {
  orderId: string;
  organizationId: string;
  grossAmount: bigint;
  currency: string;
  tx?: unknown; // Prisma transaction client
}

export interface RecordRefundInput {
  orderId: string;
  organizationId: string;
  refundAmount: bigint;
  currency: string;
  tx?: unknown;
}

export interface RecordChargebackInput {
  orderId: string;
  organizationId: string;
  chargebackAmount: bigint;
  currency: string;
  tx?: unknown;
}

export interface IFinancialRecordPort {
  recordSale(input: RecordSaleInput): Promise<void>;
  recordRefund(input: RecordRefundInput): Promise<void>;
  recordChargeback(input: RecordChargebackInput): Promise<void>;
}
