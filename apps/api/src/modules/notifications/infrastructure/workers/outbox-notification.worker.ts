import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../platform/database/prisma.service";
import { SendEmailUseCase, SendEmailInput } from "../../application/use-cases/send-email.use-case";

// NOTE (TASK-045 MVP): The current schema does not have a buyer email on orders or reservations.
// Orders and reservations are not linked to a User (no user_id on the orders table).
// As a result, this worker uses a dev placeholder email "comprador@ticket-seller.local".
// A future task should add buyer identity to the order model (e.g., buyer_email or user_id FK)
// and update this worker accordingly.
const DEV_PLACEHOLDER_EMAIL = "comprador@ticket-seller.local";

// Event types handled by this worker
const HANDLED_TYPES = ["order.paid.v1"];

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
  private readonly pollIntervalMs = 5_000;

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
    try {
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
    }
  }

  private async processEvent(row: OutboxEventRow): Promise<void> {
    try {
      const payload = typeof row.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : row.payload;

      if (row.type === "order.paid.v1") {
        await this.handleOrderPaid(row.id, payload, row.organization_id);
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
      this.logger.warn(`order.paid.v1 event id=${outboxEventId} missing orderId in payload`);
      return;
    }

    // MVP: use placeholder email since orders have no buyer email or user link
    const recipientEmail = DEV_PLACEHOLDER_EMAIL;

    const subject = "Seu pedido foi confirmado!";
    const text = [
      "Olá!",
      "",
      `Seu pedido #${orderId} foi confirmado com sucesso.`,
      "Em breve seus ingressos estarão disponíveis.",
      "",
      "Obrigado por comprar conosco!",
    ].join("\n");

    const input: SendEmailInput = {
      orderId,
      eventType: "order.paid.v1",
      recipientEmail,
      subject,
      text,
      outboxEventId,
    };
    if (organizationId !== null) input.organizationId = organizationId;

    await this.sendEmail.execute(input);
  }
}
