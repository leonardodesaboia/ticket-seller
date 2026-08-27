import type {
  IPaymentChargebackOperationPort,
  ProcessChargebackOperationInput,
} from '../ports/payment-chargeback-operation.port';

export type ProcessChargebackInput = ProcessChargebackOperationInput;

export class ProcessChargebackUseCase {
  constructor(private readonly operation: IPaymentChargebackOperationPort) {}

  async execute(input: ProcessChargebackInput): Promise<void> {
    await this.operation.execute(input);
  }
}
