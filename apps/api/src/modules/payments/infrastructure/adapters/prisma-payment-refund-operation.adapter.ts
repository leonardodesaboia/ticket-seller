import * as crypto from 'node:crypto';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PaymentGatewayPort,
} from '../../domain/ports/payment-gateway.port';
import {
  OrderNotFoundForRefundError,
  OrderNotRefundableError,
  RefundGatewayError,
} from '../../domain/refund.errors';
import {
  IFinancialRecordPort,
} from '../../../finance/contracts/financial-record.contract';
import { ILogger } from '../../../../shared/kernel/logger.port';

export interface ProcessRefundInput {
  orderId: string;
  organizationId: string;
  actorId?: string;
}

export interface ProcessRefundResult {
  orderId: string;
  organizationId: string;
  status: 'REFUNDED';
  refundedAmount: number;
  currency: string;
  externalRefundId: string;
}

interface RawOrderRow {
  id: string;
  organization_id: string;
  status: string;
  total_amount: bigint;
  currency: string;
  buyer_email: string | null;
}

interface RawAttemptRow {
  id: string;
  external_payment_id: string | null;
}

interface RawRefundRow {
  id: string;
  status: string;
  external_refund_id: string | null;
  amount: bigint;
  currency: string;
}

export class PrismaPaymentRefundOperationAdapter {
  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly prisma: PrismaService,
    private readonly financialRecord: IFinancialRecordPort,
    private readonly logger: ILogger,
  ) {}

  async execute(input: ProcessRefundInput): Promise<ProcessRefundResult> {
    const { orderId, organizationId } = input;

    // 1. Find order
    const orders = await this.prisma.$queryRaw<RawOrderRow[]>`
      SELECT id, organization_id, status, total_amount, currency, buyer_email
      FROM orders
      WHERE id = ${orderId}::uuid
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    const order = orders[0] ?? null;
    if (!order) throw new OrderNotFoundForRefundError();

    // 2. Validate order is CANCELLED (or REFUNDED for idempotent re-calls)
    if (order.status === 'REFUNDED') {
      // Idempotent: return the existing successful refund instead of throwing.
      const existing = await this.prisma.$queryRaw<RawRefundRow[]>`
        SELECT id, status, external_refund_id, amount, currency
        FROM refund_attempts
        WHERE order_id = ${orderId}::uuid AND status = 'SUCCESS'
        LIMIT 1
      `;
      const refundRow = existing[0];
      if (refundRow?.external_refund_id) {
        return {
          orderId,
          organizationId,
          status: 'REFUNDED',
          refundedAmount: Number(refundRow.amount),
          currency: refundRow.currency,
          externalRefundId: refundRow.external_refund_id,
        };
      }
      throw new OrderNotRefundableError('ORDER_ALREADY_REFUNDED');
    }
    if (order.status !== 'CANCELLED') {
      throw new OrderNotRefundableError('ORDER_NOT_CANCELLED');
    }

    // 3. Find APPROVED payment attempt
    const attempts = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT id, external_payment_id
      FROM payment_attempts
      WHERE order_id = ${orderId}::uuid
        AND status = 'APPROVED'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const attempt = attempts[0] ?? null;
    if (!attempt || !attempt.external_payment_id) {
      throw new OrderNotRefundableError('NO_APPROVED_PAYMENT');
    }

    // 4. Idempotency key for this refund (stable per order)
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`refund:${orderId}`)
      .digest('hex');

    // 5. Insert or retrieve existing refund_attempt
    const existing = await this.prisma.$queryRaw<RawRefundRow[]>`
      INSERT INTO refund_attempts
        (organization_id, order_id, payment_attempt_id, idempotency_key, amount, currency, status)
      VALUES
        (${organizationId}::uuid, ${orderId}::uuid, ${attempt.id}::uuid,
         ${idempotencyKey}, ${order.total_amount}, ${order.currency}, 'PENDING')
      ON CONFLICT (order_id, idempotency_key) DO UPDATE
        SET updated_at = refund_attempts.updated_at
      RETURNING id, status, external_refund_id, amount, currency
    `;
    const refundRow = existing[0]!;

    // 6. Idempotent: already succeeded
    if (refundRow.status === 'SUCCESS' && refundRow.external_refund_id) {
      return {
        orderId,
        organizationId,
        status: 'REFUNDED',
        refundedAmount: Number(refundRow.amount),
        currency: refundRow.currency,
        externalRefundId: refundRow.external_refund_id,
      };
    }

    // 6b. Claim a pending retry. Gateway calls use the same idempotency key, so a
    // timeout can be retried safely and converge even if the PSP completed it.
    const claimed = await this.prisma.$executeRaw`
      UPDATE refund_attempts
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id = ${refundRow.id}::uuid AND status IN ('PENDING', 'FAILED')
    `;
    if (claimed === 0) {
      throw new RefundGatewayError('Refund already in progress — retry after a moment');
    }

    // 7. Call gateway
    let gatewayResult: { externalRefundId: string; status: 'SUCCESS' | 'FAILED' };
    try {
      gatewayResult = await this.gateway.refund({
        externalPaymentId: attempt.external_payment_id,
        amount: BigInt(order.total_amount),
        currency: order.currency,
        idempotencyKey,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.$executeRaw`
        UPDATE refund_attempts
        SET status = 'PENDING', error_message = ${message}, updated_at = NOW()
        WHERE id = ${refundRow.id}::uuid
      `;
      throw new RefundGatewayError(message);
    }

    if (gatewayResult.status === 'FAILED') {
      await this.prisma.$executeRaw`
        UPDATE refund_attempts
        SET status = 'PENDING', error_message = 'Gateway returned FAILED', updated_at = NOW()
        WHERE id = ${refundRow.id}::uuid
      `;
      throw new RefundGatewayError('Gateway returned FAILED');
    }

    // 8. Commit SUCCESS atomically
    await this.prisma.$transaction(async (tx) => {
      // Lock order
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM orders
        WHERE id = ${orderId}::uuid
          AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;
      const lockedOrder = locked[0];
      if (!lockedOrder) return;

      // Idempotent: already REFUNDED
      if (lockedOrder.status === 'REFUNDED') {
        await tx.$executeRaw`
          UPDATE refund_attempts
          SET status = 'SUCCESS', external_refund_id = ${gatewayResult.externalRefundId}, updated_at = NOW()
          WHERE id = ${refundRow.id}::uuid
        `;
        return;
      }

      // Mark refund attempt SUCCESS
      await tx.$executeRaw`
        UPDATE refund_attempts
        SET status = 'SUCCESS', external_refund_id = ${gatewayResult.externalRefundId}, updated_at = NOW()
        WHERE id = ${refundRow.id}::uuid
      `;

      // Transition order to REFUNDED
      await tx.$executeRaw`
        UPDATE orders
        SET status = 'REFUNDED', updated_at = NOW()
        WHERE id = ${orderId}::uuid
          AND status = 'CANCELLED'
      `;

      // Record ledger entries for refund
      await this.financialRecord.recordRefund({
        orderId,
        organizationId,
        refundAmount: BigInt(order.total_amount),
        currency: order.currency,
        tx,
      });

      // Outbox: order.refunded.v1
      await tx.$executeRaw`
        INSERT INTO outbox_events
          (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
        VALUES (
          gen_random_uuid(),
          'order',
          ${orderId},
          'order.refunded.v1',
          '1',
          ${JSON.stringify({
            orderId,
            organizationId,
            amount: Number(order.total_amount),
            currency: order.currency,
            externalRefundId: gatewayResult.externalRefundId,
            buyerEmail: order.buyer_email ?? null,
          })}::jsonb,
          ${organizationId}::uuid,
          NOW()
        )
      `;
    });

    this.logger.log(`Order ${orderId} refunded: ${gatewayResult.externalRefundId}`);

    return {
      orderId,
      organizationId,
      status: 'REFUNDED',
      refundedAmount: Number(order.total_amount),
      currency: order.currency,
      externalRefundId: gatewayResult.externalRefundId,
    };
  }
}
