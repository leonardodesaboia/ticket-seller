import * as crypto from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
  PaymentWebhookInput,
} from '../../domain/ports/payment-gateway.port';
import { ProcessChargebackUseCase } from './process-chargeback.use-case';
import {
  FINANCIAL_RECORD_PORT,
  IFinancialRecordPort,
} from '../../../finance/domain/ports/financial-record.port';

export interface ProcessWebhookInput {
  provider: string;
  rawBody: Buffer;
  signature: string;
}

interface RawAttemptRow {
  id: string;
  organization_id: string;
  order_id: string;
  external_payment_id: string | null;
  status: string;
  amount: bigint;
  currency: string;
}

interface RawOrderRow {
  id: string;
  status: string;
  organization_id: string;
  buyer_email: string | null;
}

@Injectable()
export class ProcessPaymentWebhookUseCase {
  private readonly logger = new Logger(ProcessPaymentWebhookUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly gateway: PaymentGatewayPort,
    private readonly prisma: PrismaService,
    private readonly processChargeback: ProcessChargebackUseCase,
    @Inject(FINANCIAL_RECORD_PORT)
    private readonly financialRecord: IFinancialRecordPort,
  ) {}

  async execute(input: ProcessWebhookInput): Promise<void> {
    // Step 1: Parse and validate webhook signature
    const parsed = await this.gateway.parseWebhook({
      provider: input.provider,
      rawBody: input.rawBody,
      signature: input.signature,
    } as PaymentWebhookInput);

    const { providerEventId, externalPaymentId, eventType, status, amount, currency } = parsed;

    // Step 2: Find payment attempt by external_payment_id
    const attempts = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT id, organization_id, order_id, external_payment_id, status, amount, currency
      FROM payment_attempts
      WHERE external_payment_id = ${externalPaymentId}
      LIMIT 1
    `;
    const attempt = attempts[0] ?? null;

    // Insert webhook event — ON CONFLICT DO NOTHING for deduplication
    const insertResult = await this.prisma.$executeRaw`
      INSERT INTO payment_webhook_events
        (provider, provider_event_id, payment_attempt_id, external_payment_id,
         event_type, raw_status, amount, currency)
      VALUES
        (${input.provider}, ${providerEventId}, ${attempt?.id ?? null}::uuid,
         ${externalPaymentId}, ${eventType}, ${status},
         ${amount ?? null}, ${currency ?? null})
      ON CONFLICT (provider, provider_event_id) DO NOTHING
    `;

    // If 0 rows inserted: already processed (idempotent)
    if (insertResult === 0) {
      this.logger.log(`Webhook ${providerEventId} already processed, skipping`);
      return;
    }

    if (!attempt) {
      this.logger.warn(`Webhook for unknown externalPaymentId=${externalPaymentId}`);
      await this.prisma.$executeRaw`
        UPDATE payment_webhook_events SET processed_at = NOW()
        WHERE provider = ${input.provider} AND provider_event_id = ${providerEventId}
      `;
      return;
    }

    // Step 3: Delegate PAYMENT_DISPUTED to the chargeback use case.
    // The chargeback use case maintains its own idempotency via payment_disputes
    // (ON CONFLICT on provider + external_dispute_id). The payment_webhook_events
    // table still records the raw event for audit purposes.
    if (eventType === 'PAYMENT_DISPUTED') {
      await this.processChargeback.execute({
        provider: this.gateway.provider,
        providerEventId,
        externalPaymentId,
        amount,
        currency,
      });
      await this.prisma.$executeRaw`
        UPDATE payment_webhook_events SET processed_at = NOW()
        WHERE provider = ${input.provider} AND provider_event_id = ${providerEventId}
      `;
      return;
    }

    // Step 4: Process non-chargeback events
    if (eventType === 'PAYMENT_APPROVED') {
      await this.processApproved(attempt, providerEventId, amount, currency, input.provider);
    } else {
      await this.processNonApproved(attempt, status, eventType, providerEventId, input.provider);
    }
  }

  private async processApproved(
    attempt: RawAttemptRow,
    providerEventId: string,
    webhookAmount: bigint,
    webhookCurrency: string,
    provider: string,
  ): Promise<void> {
    // Validate amount and currency match
    const attemptAmount = BigInt(attempt.amount);
    if (attemptAmount !== webhookAmount || attempt.currency !== webhookCurrency) {
      this.logger.error(
        `Amount/currency mismatch for attempt ${attempt.id}: ` +
          `expected ${attemptAmount} ${attempt.currency}, got ${webhookAmount} ${webhookCurrency}`,
      );
      await this.prisma.$executeRaw`
        UPDATE payment_webhook_events
        SET failed_at = NOW(),
            error_message = ${'Amount or currency mismatch — manual reconciliation required'}
        WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
      `;
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Lock order with FOR UPDATE
      const orders = await tx.$queryRaw<RawOrderRow[]>`
        SELECT id, status, organization_id, buyer_email
        FROM orders
        WHERE id = ${attempt.order_id}::uuid
        FOR UPDATE
      `;
      const order = orders[0];
      if (!order) return;

      // Idempotency: if already PAID or TICKETS_ISSUED, mark webhook processed and return
      if (order.status === 'PAID' || order.status === 'TICKETS_ISSUED') {
        await tx.$executeRaw`
          UPDATE payment_webhook_events SET processed_at = NOW()
          WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
        `;
        return;
      }

      // Update payment attempt to APPROVED
      await tx.$executeRaw`
        UPDATE payment_attempts
        SET status = 'APPROVED', version = version + 1, updated_at = NOW()
        WHERE id = ${attempt.id}::uuid
      `;

      // Update order to PAID
      await tx.$executeRaw`
        UPDATE orders
        SET status = 'PAID', updated_at = NOW()
        WHERE id = ${attempt.order_id}::uuid AND status = 'PENDING_PAYMENT'
      `;

      // Commit inventory: reserved → committed for each order item
      await tx.$executeRaw`
        UPDATE ticket_inventory ti
        SET
          committed  = ti.committed + oi.quantity,
          reserved   = GREATEST(ti.reserved - oi.quantity, 0),
          version    = ti.version + 1,
          updated_at = NOW()
        FROM order_items oi
        WHERE oi.order_id = ${attempt.order_id}::uuid
          AND ti.ticket_type_id = oi.ticket_type_id
          AND ti.organization_id = ${attempt.organization_id}::uuid
      `;

      // Issue tickets: one row per (order_item_id, unit_index)
      const orderItems = await tx.$queryRaw<Array<{
        id: string; ticket_type_id: string; quantity: number; event_id: string;
      }>>`
        SELECT oi.id, oi.ticket_type_id, oi.quantity, o.event_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.order_id = ${attempt.order_id}::uuid
      `;

      for (const item of orderItems) {
        for (let unitIndex = 0; unitIndex < Number(item.quantity); unitIndex++) {
          const publicCode = crypto.randomBytes(32).toString('hex');
          const ticketId = crypto.randomUUID();
          await tx.$executeRaw`
            INSERT INTO tickets
              (id, organization_id, event_id, order_id, order_item_id, ticket_type_id, unit_index, public_code)
            VALUES
              (${ticketId}::uuid, ${attempt.organization_id}::uuid, ${item.event_id}::uuid,
               ${attempt.order_id}::uuid, ${item.id}::uuid, ${item.ticket_type_id}::uuid,
               ${unitIndex}, ${publicCode})
            ON CONFLICT (order_item_id, unit_index) DO NOTHING
          `;
        }
      }

      // Record pricing snapshot for financial audit
      await this.financialRecord.recordSale({
        orderId: attempt.order_id,
        organizationId: attempt.organization_id,
        grossAmount: BigInt(attempt.amount),
        currency: attempt.currency,
        tx,
      });

      // Update order to TICKETS_ISSUED
      await tx.$executeRaw`
        UPDATE orders SET status = 'TICKETS_ISSUED', updated_at = NOW()
        WHERE id = ${attempt.order_id}::uuid AND status = 'PAID'
      `;

      // Outbox events
      const orderId = attempt.order_id;
      const orgId = attempt.organization_id;
      await tx.$executeRaw`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, type, version, payload, organization_id)
        VALUES
          ('payment_attempt', ${attempt.id}, 'payment.approved.v1', '1',
           ${JSON.stringify({ paymentAttemptId: attempt.id, orderId })}::jsonb, ${orgId}::uuid),
          ('order', ${orderId}, 'order.paid.v1', '1',
           ${JSON.stringify({ orderId, organizationId: orgId, buyerEmail: order.buyer_email ?? null })}::jsonb, ${orgId}::uuid),
          ('inventory', ${orderId}, 'inventory.committed.v1', '1',
           ${JSON.stringify({ orderId, organizationId: orgId })}::jsonb, ${orgId}::uuid),
          ('order', ${orderId}, 'order.tickets-issued.v1', '1',
           ${JSON.stringify({ orderId, organizationId: orgId })}::jsonb, ${orgId}::uuid),
          ('tickets', ${orderId}, 'tickets.issued.v1', '1',
           ${JSON.stringify({ orderId, organizationId: orgId })}::jsonb, ${orgId}::uuid)
      `;

      // Mark webhook as processed
      await tx.$executeRaw`
        UPDATE payment_webhook_events SET processed_at = NOW()
        WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
      `;
    });
  }

  private async processNonApproved(
    attempt: RawAttemptRow,
    status: string,
    eventType: string,
    providerEventId: string,
    provider: string,
  ): Promise<void> {
    const currentStatus = attempt.status;
    // Don't regress status (e.g., APPROVED → PENDING is ignored)
    const terminal = ['APPROVED', 'DECLINED', 'CANCELLED', 'EXPIRED'];
    if (terminal.includes(currentStatus) && currentStatus !== status) {
      this.logger.warn(
        `Ignoring status regression for attempt ${attempt.id}: ${currentStatus} → ${status}`,
      );
      await this.prisma.$executeRaw`
        UPDATE payment_webhook_events SET processed_at = NOW()
        WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
      `;
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE payment_attempts
        SET status = ${status}, version = version + 1, updated_at = NOW()
        WHERE id = ${attempt.id}::uuid
      `;

      const outboxType =
        eventType === 'PAYMENT_DECLINED' ? 'payment.declined.v1' : 'payment.cancelled.v1';
      await tx.$executeRaw`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, type, version, payload, organization_id)
        VALUES ('payment_attempt', ${attempt.id}, ${outboxType}, '1',
                ${JSON.stringify({ paymentAttemptId: attempt.id, orderId: attempt.order_id })}::jsonb,
                ${attempt.organization_id}::uuid)
      `;

      await tx.$executeRaw`
        UPDATE payment_webhook_events SET processed_at = NOW()
        WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
      `;
    });
  }
}
