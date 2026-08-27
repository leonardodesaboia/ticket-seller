export interface ProcessPaymentWebhookOperationInput {
  provider: string;
  rawBody: Buffer;
  signature: string;
}

export interface IPaymentWebhookOperationPort {
  process(input: ProcessPaymentWebhookOperationInput): Promise<void>;
}

export const PAYMENT_WEBHOOK_OPERATION_PORT = Symbol('PAYMENT_WEBHOOK_OPERATION_PORT');
