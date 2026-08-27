import type {
  IPaymentWebhookOperationPort,
  ProcessPaymentWebhookOperationInput,
} from '../ports/payment-webhook-operation.port';

export type ProcessWebhookInput = ProcessPaymentWebhookOperationInput;

export class ProcessPaymentWebhookUseCase {
  constructor(private readonly operation: IPaymentWebhookOperationPort) {}

  async execute(input: ProcessWebhookInput): Promise<void> {
    await this.operation.process(input);
  }
}
