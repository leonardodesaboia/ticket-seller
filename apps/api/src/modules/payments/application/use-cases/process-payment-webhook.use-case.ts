import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
  PaymentWebhookInput,
} from '../../domain/ports/payment-gateway.port';

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
}

@Injectable()
export class ProcessPaymentWebhookUseCase {
  private readonly logger = new Logger(ProcessPaymentWebhookUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly gateway: PaymentGatewayPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: ProcessWebhookInput): Promise<void> {
    // Step 1: Parse and validate webhook signature
    const parsed = await this.gateway.parseWebhook({
      provider: 'FAKE',
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
        (${'FAKE'}, ${providerEventId}, ${attempt?.id ?? null}::uuid,
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
        WHERE provider = 'FAKE' AND provider_event_id = ${providerEventId}
      `;
      return;
    }

    // Step 3: Process based on event type
    if (eventType === 'PAYMENT_APPROVED') {
      await this.processApproved(attempt, providerEventId, amount, currency);
    } else {
      await this.processNonApproved(attempt, status, eventType, providerEventId);
    }
  }

  private async processApproved(
    attempt: RawAttemptRow,
    providerEventId: string,
    webhookAmount: bigint,
    webhookCurrency: string,
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
        WHERE provider = 'FAKE' AND provider_event_id = ${providerEventId}
      `;
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Lock order with FOR UPDATE
      const orders = await tx.$queryRaw<RawOrderRow[]>`
        SELECT id, status, organization_id
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
          WHERE provider = 'FAKE' AND provider_event_id = ${providerEventId}
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

      // Outbox events
      const orderId = attempt.order_id;
      const orgId = attempt.organization_id;
      await tx.$executeRaw`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, type, version, payload, organization_id)
        VALUES
          ('payment_attempt', ${attempt.id}, 'payment.approved.v1', '1',
           ${JSON.stringify({ paymentAttemptId: attempt.id, orderId })}::jsonb, ${orgId}::uuid),
          ('order', ${orderId}, 'order.paid.v1', '1',
           ${JSON.stringify({ orderId, organizationId: orgId })}::jsonb, ${orgId}::uuid),
          ('inventory', ${orderId}, 'inventory.committed.v1', '1',
           ${JSON.stringify({ orderId, organizationId: orgId })}::jsonb, ${orgId}::uuid)
      `;

      // Mark webhook as processed
      await tx.$executeRaw`
        UPDATE payment_webhook_events SET processed_at = NOW()
        WHERE provider = 'FAKE' AND provider_event_id = ${providerEventId}
      `;
    });
  }

  private async processNonApproved(
    attempt: RawAttemptRow,
    status: string,
    eventType: string,
    providerEventId: string,
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
        WHERE provider = 'FAKE' AND provider_event_id = ${providerEventId}
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
        WHERE provider = 'FAKE' AND provider_event_id = ${providerEventId}
      `;
    });
  }
}
