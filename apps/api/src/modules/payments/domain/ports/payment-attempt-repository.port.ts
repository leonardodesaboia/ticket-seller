import { PaymentAttempt } from '../payment-attempt.entity';

export interface CreatePaymentAttemptData {
  id: string;
  organizationId: string;
  orderId: string;
  provider: string;
  externalPaymentId: string | null;
  status: string;
  paymentMethod: string;
  amount: bigint;
  currency: string;
  idempotencyKey: string | null;
  checkoutData: Record<string, unknown> | null;
  expiresAt: Date;
}

export interface UpdatePaymentAttemptData {
  externalPaymentId?: string;
  status?: string;
  checkoutData?: Record<string, unknown> | null;
  failureCode?: string | null;
}

export interface IPaymentAttemptRepository {
  save(data: CreatePaymentAttemptData): Promise<PaymentAttempt>;
  update(id: string, data: UpdatePaymentAttemptData): Promise<PaymentAttempt>;
  findById(id: string): Promise<PaymentAttempt | null>;
  findLatestByOrderId(orderId: string): Promise<PaymentAttempt | null>;
  findByIdempotencyKey(key: string): Promise<PaymentAttempt | null>;
  findActiveByOrderId(orderId: string): Promise<PaymentAttempt | null>;
}

export const PAYMENT_ATTEMPT_REPOSITORY = Symbol('PAYMENT_ATTEMPT_REPOSITORY');
