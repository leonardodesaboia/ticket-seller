import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  FINANCIAL_RECORD_PORT,
  IFinancialRecordPort,
} from '../../../finance/domain/ports/financial-record.port';

export interface ProcessChargebackInput {
  provider: string;
  providerEventId: string;
  externalPaymentId: string;
  amount: bigint;
  currency: string;
}

interface RawAttemptRow {
  id: string;
  organization_id: string;
  order_id: string;
  external_payment_id: string | null;
}

interface RawOrderRow {
  id: string;
  status: string;
  organization_id: string;
}

interface RawTicketRow {
  id: string;
}

@Injectable()
export class ProcessChargebackUseCase {
  private readonly logger = new Logger(ProcessChargebackUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FINANCIAL_RECORD_PORT)
    private readonly financialRecord: IFinancialRecordPort,
  ) {}

  async execute(input: ProcessChargebackInput): Promise<void> {
    const { provider, providerEventId, externalPaymentId, amount, currency } = input;

    // 1. Find payment attempt by external_payment_id
    const attempts = await this.prisma.$queryRaw<RawAttemptRow[]>`
      SELECT id, organization_id, order_id, external_payment_id
      FROM payment_attempts
      WHERE external_payment_id = ${externalPaymentId}
      LIMIT 1
    `;
    const attempt = attempts[0] ?? null;

    if (!attempt) {
      this.logger.warn(
        `PAYMENT_DISPUTED for unknown externalPaymentId=${externalPaymentId}, providerEventId=${providerEventId}`,
      );
      return;
    }

    // 2. INSERT payment_disputes — ON CONFLICT DO NOTHING for idempotency
    //    The unique constraint is on (provider, external_dispute_id).
    //    We use providerEventId as the external_dispute_id since the PSP
    //    sends a unique event ID per dispute notification.
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO payment_disputes
        (organization_id, order_id, payment_attempt_id, provider, external_dispute_id,
         status, amount, currency)
      VALUES
        (${attempt.organization_id}::uuid, ${attempt.order_id}::uuid,
         ${attempt.id}::uuid, ${provider}, ${providerEventId},
         'OPEN', ${amount ?? null}, ${currency ?? null})
      ON CONFLICT (provider, external_dispute_id) DO NOTHING
    `;

    // 0 rows → already processed (idempotent)
    if (inserted === 0) {
      this.logger.log(`Chargeback ${providerEventId} already processed, skipping`);
      return;
    }

    // 3. Find order associated to the attempt
    const orders = await this.prisma.$queryRaw<RawOrderRow[]>`
      SELECT id, status, organization_id
      FROM orders
      WHERE id = ${attempt.order_id}::uuid
      LIMIT 1
    `;
    const order = orders[0] ?? null;

    if (!order) {
      this.logger.warn(
        `PAYMENT_DISPUTED: order ${attempt.order_id} not found for attempt ${attempt.id}`,
      );
      await this.prisma.$executeRaw`
        UPDATE payment_disputes SET updated_at = NOW()
        WHERE provider = ${provider} AND external_dispute_id = ${providerEventId}
      `;
      return;
    }

    // 4. Only transition if order is in a disputable state
    if (order.status !== 'PAID' && order.status !== 'TICKETS_ISSUED') {
      this.logger.log(
        `PAYMENT_DISPUTED: order ${order.id} has status ${order.status} — skipping state transition`,
      );
      await this.prisma.$executeRaw`
        UPDATE payment_disputes SET updated_at = NOW()
        WHERE provider = ${provider} AND external_dispute_id = ${providerEventId}
      `;
      return;
    }

    // 5. Execute chargeback in a transaction with SELECT FOR UPDATE
    await this.prisma.$transaction(async (tx) => {
      // Lock the order
      const locked = await tx.$queryRaw<RawOrderRow[]>`
        SELECT id, status, organization_id
        FROM orders
        WHERE id = ${attempt.order_id}::uuid
        FOR UPDATE
      `;
      const lockedOrder = locked[0];
      if (!lockedOrder) return;

      // Re-check status under lock (another concurrent chargeback might have beaten us)
      if (lockedOrder.status !== 'PAID' && lockedOrder.status !== 'TICKETS_ISSUED') {
        this.logger.log(
          `PAYMENT_DISPUTED (under lock): order ${lockedOrder.id} has status ${lockedOrder.status} — skipping`,
        );
        return;
      }

      const orderId = attempt.order_id;
      const organizationId = attempt.organization_id;

      // 5b. Cancel ACTIVE tickets
      const cancelledTickets = await tx.$queryRaw<RawTicketRow[]>`
        UPDATE tickets
        SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
        WHERE order_id = ${orderId}::uuid
          AND status = 'ACTIVE'
        RETURNING id
      `;
      const cancelledIds = cancelledTickets.map((t) => t.id);

      // 5c. Revoke credentials for cancelled tickets
      if (cancelledIds.length > 0) {
        await tx.$executeRaw`
          UPDATE ticket_credentials
          SET status = 'REVOKED', revoked_at = NOW()
          WHERE ticket_id = ANY(${cancelledIds}::uuid[])
        `;
      }

      // 5d. Release committed inventory
      await tx.$executeRaw`
        UPDATE ticket_inventory ti
        SET
          committed  = GREATEST(ti.committed - oi.quantity, 0),
          version    = ti.version + 1,
          updated_at = NOW()
        FROM order_items oi
        WHERE oi.order_id = ${orderId}::uuid
          AND ti.ticket_type_id = oi.ticket_type_id
          AND ti.organization_id = ${organizationId}::uuid
      `;

      // 5e. Transition order to CHARGEBACK
      await tx.$executeRaw`
        UPDATE orders
        SET status = 'CHARGEBACK', updated_at = NOW()
        WHERE id = ${orderId}::uuid
      `;

      // 5f. Insert outbox event order.chargeback.v1
      await tx.$executeRaw`
        INSERT INTO outbox_events
          (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
        VALUES (
          gen_random_uuid(),
          'order',
          ${orderId},
          'order.chargeback.v1',
          '1',
          ${JSON.stringify({ orderId, organizationId, externalDisputeId: providerEventId })}::jsonb,
          ${organizationId}::uuid,
          NOW()
        )
      `;

      // 5g. Record ledger entries for chargeback
      await this.financialRecord.recordChargeback({
        orderId,
        organizationId,
        chargebackAmount: amount ?? 0n,
        currency: currency ?? 'BRL',
        tx,
      });
    });

    // 6. Mark dispute as processed
    await this.prisma.$executeRaw`
      UPDATE payment_disputes
      SET status = 'PROCESSED', updated_at = NOW()
      WHERE provider = ${provider} AND external_dispute_id = ${providerEventId}
    `;

    this.logger.log(
      `Chargeback processed: order=${attempt.order_id} externalDisputeId=${providerEventId}`,
    );
  }
}
