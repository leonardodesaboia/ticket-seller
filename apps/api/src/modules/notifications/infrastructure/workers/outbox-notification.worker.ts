import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../platform/database/prisma.service";
import { SendEmailUseCase, SendEmailInput } from "../../application/use-cases/send-email.use-case";
import { env } from "../../../../platform/config/env";


const HANDLED_TYPES = [
  "order.paid.v1",
  "order.cancelled.v1",
  "order.refunded.v1",
  "event.cancelled.v1",
  "order.chargeback.v1",
];

interface OutboxEventRow {
  id: string;
  type: string;
  payload: string | Record<string, unknown>;
  organization_id: string | null;
}

@Injectable()
export class OutboxNotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxNotificationWorker.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = env.OUTBOX_POLL_INTERVAL_MS;
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendEmail: SendEmailUseCase,
  ) {}

  onModuleInit(): void {
    this.logger.log("OutboxNotificationWorker started — polling every 5s");
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log("OutboxNotificationWorker stopped");
    }
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      // FOR UPDATE SKIP LOCKED cannot be used here because email I/O must happen
      // outside a transaction — holding a row lock open during an HTTP call would
      // exhaust the connection pool. Duplicate-send prevention is handled by
      // notification_log in SendEmailUseCase (unique check per orderId+eventType
      // or outboxEventId before each send).
      const rows = await this.prisma.$queryRaw<OutboxEventRow[]>`
        SELECT id, type, payload, organization_id
        FROM outbox_events
        WHERE type = ANY(${HANDLED_TYPES}::text[])
          AND processed_at IS NULL
          AND failed_at IS NULL
        ORDER BY occurred_at ASC
        LIMIT 10
      `;

      for (const row of rows) {
        await this.processEvent(row);
      }
    } catch (err) {
      this.logger.error("Error polling outbox_events", err);
    } finally {
      this.isPolling = false;
    }
  }

  private async processEvent(row: OutboxEventRow): Promise<void> {
    try {
      const payload = typeof row.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : row.payload;

      switch (row.type) {
        case "order.paid.v1":
          await this.handleOrderPaid(row.id, payload, row.organization_id);
          break;
        case "order.cancelled.v1":
          await this.handleOrderCancelled(row.id, payload, row.organization_id);
          break;
        case "order.refunded.v1":
          await this.handleOrderRefunded(row.id, payload, row.organization_id);
          break;
        case "event.cancelled.v1":
          await this.handleEventCancelled(row.id, payload, row.organization_id);
          break;
        case "order.chargeback.v1":
          await this.handleOrderChargeback(row.id, payload, row.organization_id);
          break;
      }

      // Mark event as processed
      await this.prisma.$executeRaw`
        UPDATE outbox_events
        SET processed_at = NOW(), attempts = attempts + 1
        WHERE id = ${row.id}::uuid
      `;
    } catch (err) {
      this.logger.error(`Failed to process outbox event id=${row.id} type=${row.type}`, err);
      await this.prisma.$executeRaw`
        UPDATE outbox_events
        SET failed_at = NOW(),
            attempts = attempts + 1,
            last_error = ${String(err instanceof Error ? err.message : err)}
        WHERE id = ${row.id}::uuid
      `;
    }
  }

  private async handleOrderPaid(
    outboxEventId: string,
    payload: Record<string, unknown>,
    organizationId: string | null,
  ): Promise<void> {
    const orderId = payload["orderId"] as string | undefined;
    if (orderId === undefined) {
      this.logger.warn(`order.paid.v1 event id=${outboxEventId} missing orderId`);
      return;
    }

    const buyerEmail = payload["buyerEmail"] as string | undefined;
    if (!buyerEmail) {
      this.logger.warn(`order.paid.v1 event id=${outboxEventId} missing buyerEmail, skipping`);
      return;
    }

    const input: SendEmailInput = {
      orderId,
      eventType: "order.paid.v1",
      recipientEmail: buyerEmail,
      subject: "Seu pedido foi confirmado!",
      text: [
        "Olá!",
        "",
        `Seu pedido #${orderId} foi confirmado com sucesso.`,
        "Em breve seus ingressos estarão disponíveis.",
        "",
        "Obrigado por comprar conosco!",
      ].join("\n"),
      outboxEventId,
    };
    if (organizationId !== null) input.organizationId = organizationId;
    await this.sendEmail.execute(input);
  }

  private async handleOrderCancelled(
    outboxEventId: string,
    payload: Record<string, unknown>,
    organizationId: string | null,
  ): Promise<void> {
    const orderId = payload["orderId"] as string | undefined;
    if (orderId === undefined) {
      this.logger.warn(`order.cancelled.v1 event id=${outboxEventId} missing orderId`);
      return;
    }

    const buyerEmail = payload["buyerEmail"] as string | undefined;
    if (!buyerEmail) {
      this.logger.warn(`order.cancelled.v1 event id=${outboxEventId} missing buyerEmail, skipping`);
      return;
    }

    const reason = payload["reason"] as string | null | undefined;
    const reasonLine = reason ? `\nMotivo: ${reason}` : "";

    const input: SendEmailInput = {
      orderId,
      eventType: "order.cancelled.v1",
      recipientEmail: buyerEmail,
      subject: "Seu pedido foi cancelado",
      text: [
        "Olá!",
        "",
        `Seu pedido #${orderId} foi cancelado.${reasonLine}`,
        "",
        "Se você efetuou pagamento e o reembolso for aplicável, ele será processado em breve.",
        "Em caso de dúvidas, entre em contato com nosso suporte.",
      ].join("\n"),
      outboxEventId,
    };
    if (organizationId !== null) input.organizationId = organizationId;
    await this.sendEmail.execute(input);
  }

  private async handleOrderRefunded(
    outboxEventId: string,
    payload: Record<string, unknown>,
    organizationId: string | null,
  ): Promise<void> {
    const orderId = payload["orderId"] as string | undefined;
    if (orderId === undefined) {
      this.logger.warn(`order.refunded.v1 event id=${outboxEventId} missing orderId`);
      return;
    }

    const buyerEmail = payload["buyerEmail"] as string | undefined;
    if (!buyerEmail) {
      this.logger.warn(`order.refunded.v1 event id=${outboxEventId} missing buyerEmail, skipping`);
      return;
    }

    const amountRaw = payload["amount"] as string | number | undefined;
    const currency = (payload["currency"] as string | undefined) ?? "BRL";
    const amountFormatted = amountRaw !== undefined
      ? (() => {
          const rawStr = String(amountRaw ?? '0').split('.')[0] ?? '0'; // remove decimals if any
          const units = BigInt(rawStr);
          const major = (units / 100n).toString();
          const minor = String(units % 100n).padStart(2, '0');
          return `${major}.${minor} ${currency}`;
        })()
      : "valor integral";

    const input: SendEmailInput = {
      orderId,
      eventType: "order.refunded.v1",
      recipientEmail: buyerEmail,
      subject: "Seu reembolso foi processado",
      text: [
        "Olá!",
        "",
        `O reembolso do seu pedido #${orderId} foi processado com sucesso.`,
        `Valor reembolsado: ${amountFormatted}.`,
        "",
        "O crédito pode levar até 10 dias úteis para aparecer em seu extrato.",
        "Obrigado por usar nossa plataforma!",
      ].join("\n"),
      outboxEventId,
    };
    if (organizationId !== null) input.organizationId = organizationId;
    await this.sendEmail.execute(input);
  }

  private async handleEventCancelled(
    outboxEventId: string,
    payload: Record<string, unknown>,
    organizationId: string | null,
  ): Promise<void> {
    const eventId = payload["eventId"] as string | undefined;
    if (eventId === undefined) {
      this.logger.warn(`event.cancelled.v1 event id=${outboxEventId} missing eventId`);
      return;
    }

    const reason = payload["reason"] as string | null | undefined;
    const ordersCancelled = payload["ordersCancelledCount"] as number | undefined;
    const reasonLine = reason ? `\nMotivo: ${reason}` : "";

    // No orderId for this event — idempotency is handled via outboxEventId in SendEmailUseCase
    const input: SendEmailInput = {
      eventType: "event.cancelled.v1",
      recipientEmail: env.ADMIN_NOTIFICATION_EMAIL,
      subject: "Evento cancelado — alerta administrativo",
      text: [
        "Este é um alerta administrativo.",
        "",
        `O evento #${eventId} foi cancelado.${reasonLine}`,
        `Pedidos afetados: ${ordersCancelled ?? "desconhecido"}.`,
        "",
        "Os compradores com pedidos ativos já receberam notificação individual.",
      ].join("\n"),
      outboxEventId,
    };
    if (organizationId !== null) input.organizationId = organizationId;
    await this.sendEmail.execute(input);
  }

  private async handleOrderChargeback(
    outboxEventId: string,
    payload: Record<string, unknown>,
    organizationId: string | null,
  ): Promise<void> {
    const orderId = payload["orderId"] as string | undefined;
    if (orderId === undefined) {
      this.logger.warn(`order.chargeback.v1 event id=${outboxEventId} missing orderId`);
      return;
    }

    const externalDisputeId = payload["externalDisputeId"] as string | undefined;
    const disputeLine = externalDisputeId ? `Disputa externa: ${externalDisputeId}` : "";

    const input: SendEmailInput = {
      orderId,
      eventType: "order.chargeback.v1",
      recipientEmail: env.ADMIN_NOTIFICATION_EMAIL,
      subject: "Alerta: chargeback recebido",
      text: [
        "Alerta administrativo — chargeback recebido.",
        "",
        `Pedido: #${orderId}`,
        disputeLine,
        "",
        "O pedido foi marcado como CHARGEBACK. Os ingressos foram cancelados e",
        "o estoque foi liberado. Analise a disputa no painel da processadora.",
      ].filter(Boolean).join("\n"),
      outboxEventId,
    };
    if (organizationId !== null) input.organizationId = organizationId;
    await this.sendEmail.execute(input);
  }
}
