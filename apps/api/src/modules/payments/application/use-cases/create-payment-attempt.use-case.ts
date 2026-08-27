import * as crypto from 'node:crypto';
import {
  PaymentGatewayPort,
  PaymentMethod,
} from '../../domain/ports/payment-gateway.port';
import {
  IPaymentAttemptRepository,
} from '../../domain/ports/payment-attempt-repository.port';
import { IOrderAccessPort } from '../ports/order-access.port';
import { IPaymentAttemptOperationPort } from '../ports/payment-attempt-operation.port';
import { PaymentAttempt } from '../../domain/payment-attempt.entity';
import {
  InvalidReservationTokenForPaymentError,
  OrderExpiredForPaymentError,
  OrderNotPendingPaymentError,
  PaymentAlreadyActiveError,
  PaymentIdempotencyConflictError,
  UnsupportedPaymentMethodError,
} from '../../domain/payment-attempt.errors';

export interface CreatePaymentAttemptInput {
  orderId: string;
  reservationToken: string;
  idempotencyKey: string;
  paymentMethod: string;
}

export class CreatePaymentAttemptUseCase {
  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly attemptRepo: IPaymentAttemptRepository,
    private readonly orderAccess: IOrderAccessPort,
    private readonly operation: IPaymentAttemptOperationPort,
  ) {}

  async execute(input: CreatePaymentAttemptInput): Promise<PaymentAttempt> {
    // Validate payment method
    const supportedMethods = this.gateway.getSupportedMethods();
    if (!supportedMethods.includes(input.paymentMethod as PaymentMethod)) {
      throw new UnsupportedPaymentMethodError(input.paymentMethod);
    }

    // Idempotency check
    const existing = await this.attemptRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.orderId !== input.orderId || existing.paymentMethod !== input.paymentMethod) {
        throw new PaymentIdempotencyConflictError();
      }
      return existing;
    }

    // Validate token and fetch order
    const order = await this.orderAccess.findOrderWithToken(input.orderId, input.reservationToken);
    if (!order) {
      throw new InvalidReservationTokenForPaymentError();
    }

    // Validate order status
    if (order.status !== 'PENDING_PAYMENT') {
      throw new OrderNotPendingPaymentError(input.orderId, order.status);
    }

    // Validate order expiration
    if (order.expiresAt <= new Date()) {
      throw new OrderExpiredForPaymentError(input.orderId);
    }

    // Check for active attempt
    const activeAttempt = await this.attemptRepo.findActiveByOrderId(input.orderId);
    if (activeAttempt) {
      throw new PaymentAlreadyActiveError(input.orderId);
    }

    // Call gateway (outside DB transaction — network call)
    const gatewayResult = await this.gateway.createPayment({
      idempotencyKey: input.idempotencyKey,
      orderId: input.orderId,
      organizationId: order.organizationId,
      amount: order.totalAmount,
      currency: order.currency,
      paymentMethod: input.paymentMethod as PaymentMethod,
      description: `Order ${input.orderId}`,
    });

    // Persist attempt. The DB enforces UNIQUE PARTIAL INDEX on (order_id)
    // WHERE status IN ('PENDING', 'PROCESSING') so a concurrent second
    // insert will throw P2002 — surface as PaymentAlreadyActiveError.
    const id = crypto.randomUUID();
    let attempt: PaymentAttempt;
    try {
      attempt = await this.operation.persistAttemptWithCreatedEvent({
        id,
        organizationId: order.organizationId,
        orderId: input.orderId,
        provider: this.gateway.provider,
        externalPaymentId: gatewayResult.externalPaymentId,
        status: gatewayResult.status,
        paymentMethod: input.paymentMethod,
        amount: order.totalAmount,
        currency: order.currency,
        idempotencyKey: input.idempotencyKey,
        checkoutData: gatewayResult.checkoutData as Record<string, unknown> | null,
        expiresAt: gatewayResult.expiresAt,
      });
    } catch (err) {
      if (isUniqueActiveAttemptConflict(err)) {
        throw new PaymentAlreadyActiveError(input.orderId);
      }
      throw err;
    }

    return attempt;
  }
}

function isUniqueActiveAttemptConflict(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  if ((err as { code: unknown }).code !== 'P2002') return false;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const serialized = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return serialized.toLowerCase().includes('unique_active_payment_attempt');
}
