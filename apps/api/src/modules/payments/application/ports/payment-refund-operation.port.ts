export interface ProcessRefundOperationInput {
  orderId: string;
  organizationId: string;
  actorId?: string;
}

export interface ProcessRefundOperationResult {
  orderId: string;
  organizationId: string;
  status: 'REFUNDED';
  refundedAmount: number;
  currency: string;
  externalRefundId: string;
}

export interface IPaymentRefundOperationPort {
  execute(input: ProcessRefundOperationInput): Promise<ProcessRefundOperationResult>;
}

export const PAYMENT_REFUND_OPERATION_PORT = Symbol('PAYMENT_REFUND_OPERATION_PORT');
