import * as crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
  PaymentMethod,
} from '../../domain/ports/payment-gateway.port';
import {
  PAYMENT_ATTEMPT_REPOSITORY,
  IPaymentAttemptRepository,
} from '../../domain/ports/payment-attempt-repository.port';
import { ORDER_ACCESS_PORT, IOrderAccessPort } from '../ports/order-access.port';
import { PaymentAttempt } from '../../domain/payment-attempt.entity';
import {
  InvalidReservationTokenForPaymentError,
  OrderExpiredForPaymentError,
  OrderNotFoundForPaymentError,
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

@Injectable()
export class CreatePaymentAttemptUseCase {
  constructor(
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly gateway: PaymentGatewayPort,
    @Inject(PAYMENT_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IPaymentAttemptRepository,
    @Inject(ORDER_ACCESS_PORT)
    private readonly orderAccess: IOrderAccessPort,
    private readonly prisma: PrismaService,
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
      // Distinguish between not found and invalid token by checking order existence
      const orderExists = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM orders WHERE id = ${input.orderId}::uuid) AS exists
      `;
      if (!orderExists[0]?.exists) {
        throw new OrderNotFoundForPaymentError(input.orderId);
      }
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

    // Persist attempt
    const id = crypto.randomUUID();
    const attempt = await this.attemptRepo.save({
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

    // Outbox: payment.created.v1
    await this.prisma.$executeRaw`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, type, version, payload, organization_id)
      VALUES ('payment_attempt', ${id}, 'payment.created.v1', '1',
              ${JSON.stringify({ paymentAttemptId: id, orderId: input.orderId, provider: this.gateway.provider })}::jsonb,
              ${order.organizationId}::uuid)
    `;

    return attempt;
  }
}
