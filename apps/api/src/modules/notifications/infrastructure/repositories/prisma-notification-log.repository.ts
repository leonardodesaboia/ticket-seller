import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../platform/database/prisma.service";
import type {
  INotificationLogRepository,
  NotificationLogEntry,
} from "../../domain/ports/notification-log-repository.port";

interface NotificationLogRow {
  id: string;
}

@Injectable()
export class PrismaNotificationLogRepository implements INotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasBeenSent(orderId: string, eventType: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<NotificationLogRow[]>`
      SELECT id
      FROM notification_log
      WHERE order_id = ${orderId}::uuid
        AND event_type = ${eventType}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async hasBeenSentForOutboxEvent(outboxEventId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<NotificationLogRow[]>`
      SELECT id
      FROM notification_log
      WHERE outbox_event_id = ${outboxEventId}::uuid
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async record(entry: NotificationLogEntry): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO notification_log
        (organization_id, order_id, event_type, recipient_email, outbox_event_id)
      VALUES (
        ${entry.organizationId ?? null}::uuid,
        ${entry.orderId ?? null}::uuid,
        ${entry.eventType},
        ${entry.recipientEmail},
        ${entry.outboxEventId ?? null}::uuid
      )
      ON CONFLICT DO NOTHING
    `;
  }
}
