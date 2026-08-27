import type { PaymentAttempt } from '../../domain/payment-attempt.entity';
import type { CreatePaymentAttemptData } from '../../domain/ports/payment-attempt-repository.port';

export interface IPaymentAttemptOperationPort {
  persistAttemptWithCreatedEvent(data: CreatePaymentAttemptData): Promise<PaymentAttempt>;
}

export const PAYMENT_ATTEMPT_OPERATION_PORT = Symbol('PAYMENT_ATTEMPT_OPERATION_PORT');
