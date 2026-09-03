import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  CreatePaymentAttemptData,
} from '../../domain/ports/payment-attempt-repository.port';
import {
  PaymentAttempt,
  PaymentAttemptMethod,
  PaymentAttemptProvider,
  PaymentAttemptStatus,
} from '../../domain/payment-attempt.entity';
import type {
  IPaymentAttemptOperationPort,
} from '../../application/ports/payment-attempt-operation.port';

interface RawAttemptRow {
  id: string; organization_id: string; order_id: string; provider: string;
  external_payment_id: string | null; status: string; payment_method: string;
  amount: bigint; currency: string; idempotency_key: string | null;
  failure_code: string | null; checkout_data: unknown; expires_at: Date;
  version: number; created_at: Date; updated_at: Date;
}

@Injectable()
export class PrismaPaymentAttemptOperationAdapter implements IPaymentAttemptOperationPort {
  constructor(private readonly prisma: PrismaService) {}

  async persistAttemptWithCreatedEvent(data: CreatePaymentAttemptData): Promise<PaymentAttempt> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RawAttemptRow[]>`
        INSERT INTO payment_attempts
          (id, organization_id, order_id, provider, external_payment_id, status, payment_method, amount, currency, idempotency_key, checkout_data, expires_at)
        VALUES
          (${data.id}::uuid, ${data.organizationId}::uuid, ${data.orderId}::uuid, ${data.provider}, ${data.externalPaymentId}, ${data.status}, ${data.paymentMethod}, ${data.amount}, ${data.currency}, ${data.idempotencyKey}, ${data.checkoutData ? JSON.stringify(data.checkoutData) : null}::jsonb, ${data.expiresAt})
        RETURNING id, organization_id, order_id, provider, external_payment_id, status,
                  payment_method, amount, currency, idempotency_key, failure_code,
                  checkout_data, expires_at, version, created_at, updated_at
      `;
      await tx.$executeRaw`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, type, version, payload, organization_id)
        VALUES ('payment_attempt', ${data.id}, 'payment.created.v1', '1',
          ${JSON.stringify({ paymentAttemptId: data.id, orderId: data.orderId, provider: data.provider })}::jsonb, ${data.organizationId}::uuid)
      `;
      const row = rows[0]!;
      return new PaymentAttempt({
        id: row.id, organizationId: row.organization_id, orderId: row.order_id,
        provider: row.provider as PaymentAttemptProvider, externalPaymentId: row.external_payment_id,
        status: row.status as PaymentAttemptStatus, paymentMethod: row.payment_method as PaymentAttemptMethod,
        amount: BigInt(row.amount), currency: row.currency, idempotencyKey: row.idempotency_key,
        failureCode: row.failure_code, checkoutData: row.checkout_data as Record<string, unknown> | null,
        expiresAt: row.expires_at, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    });
  }
}
