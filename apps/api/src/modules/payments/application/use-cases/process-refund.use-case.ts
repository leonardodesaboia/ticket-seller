import type {
  IPaymentRefundOperationPort,
  ProcessRefundOperationInput,
  ProcessRefundOperationResult,
} from '../ports/payment-refund-operation.port';

export type ProcessRefundInput = ProcessRefundOperationInput;
export type ProcessRefundResult = ProcessRefundOperationResult;

export class ProcessRefundUseCase {
  constructor(private readonly operation: IPaymentRefundOperationPort) {}

  async execute(input: ProcessRefundInput): Promise<ProcessRefundResult> {
    return this.operation.execute(input);
  }
}
