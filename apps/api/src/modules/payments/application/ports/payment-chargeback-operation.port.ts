export interface ProcessChargebackOperationInput {
  provider: string;
  providerEventId: string;
  externalPaymentId: string;
  amount: bigint;
  currency: string;
}

export interface IPaymentChargebackOperationPort {
  execute(input: ProcessChargebackOperationInput): Promise<void>;
}

export const PAYMENT_CHARGEBACK_OPERATION_PORT = Symbol('PAYMENT_CHARGEBACK_OPERATION_PORT');
