import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PaymentAttempt,
  PaymentAttemptMethod,
  PaymentAttemptProvider,
  PaymentAttemptStatus,
} from '../../domain/payment-attempt.entity';
import {
  CreatePaymentAttemptData,
  IPaymentAttemptRepository,
  UpdatePaymentAttemptData,
} from '../../domain/ports/payment-attempt-repository.port';

interface RawAttemptRow {
  id: string;
  organization_id: string;
  order_id: string;
  provider: string;
  external_payment_id: string | null;
  status: string;
  payment_method: string;
  amount: bigint;
  currency: string;
  idempotency_key: string | null;
  failure_code: string | null;
  checkout_data: unknown;
  expires_at: Date;
  version: number;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: RawAttemptRow): PaymentAttempt {
  return new PaymentAttempt({
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    provider: row.provider as PaymentAttemptProvider,
    externalPaymentId: row.external_payment_id,
    status: row.status as PaymentAttemptStatus,
    paymentMethod: row.payment_method as PaymentAttemptMethod,
    amount: BigInt(row.amount),
    currency: row.currency,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    checkoutData: row.checkout_data as Record<string, unknown> | null,
    expiresAt: row.expires_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class PrismaPaymentAttemptRepository implements IPaymentAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: CreatePaymentAttemptData): Promise<PaymentAttempt> {
    const rows = await this.prisma.$queryRaw<RawAttemptRow[]>`
      INSERT INTO payment_attempts
        (id, organization_id, order_id, provider, external_payment_id, status,
         payment_method, amount, currency, idempotency_key, checkout_data, expires_at)
      VALUES
        (${data.id}::uuid, ${data.organizationId}::uuid, ${data.orderId}::uuid,
         ${data.provider}, ${data.externalPaymentId}, ${data.status},
         ${data.paymentMethod}, ${data.amount}, ${data.currency},
         ${data.idempotencyKey}, ${data.checkoutData ? JSON.stringify(data.checkoutData) : null}::jsonb,
         ${data.expiresAt})
      RETURNING *
    `;
    return toEntity(rows[0]!);
  }

  async update(id: string, data: UpdatePaymentAttemptData): Promise<PaymentAttempt> {
    const rows = await this.prisma.$queryRaw<RawAttemptRow[]>`
      UPDATE payment_attempts
      SET
        external_payment_id = COALESCE(${data.externalPaymentId ?? null}, external_payment_id),
        status              = COALESCE(${data.status ?? null}, status),
        checkout_data       = CASE WHEN ${data.checkoutData !== undefined} THEN ${data.checkoutData ? JSON.stringify(data.checkoutData) : null}::jsonb ELSE checkout_data END,
        failure_code        = CASE WHEN ${data.failureCode !== undefined} THEN ${data.failureCode ?? null} ELSE failure_code END,
        version             = version + 1,
        updated_at          = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;
    return toEntity(rows[0]!);
  }

  async findById(id: string): Promise<PaymentAttempt | null> {
    const rows = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT * FROM payment_attempts WHERE id = ${id}::uuid LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findLatestByOrderId(orderId: string): Promise<PaymentAttempt | null> {
    const rows = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT * FROM payment_attempts
      WHERE order_id = ${orderId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentAttempt | null> {
    const rows = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT * FROM payment_attempts
      WHERE idempotency_key = ${key}
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findActiveByOrderId(orderId: string): Promise<PaymentAttempt | null> {
    const rows = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT * FROM payment_attempts
      WHERE order_id = ${orderId}::uuid
        AND status IN ('PENDING', 'PROCESSING')
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }
}
