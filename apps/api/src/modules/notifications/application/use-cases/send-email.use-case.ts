import { IEmailProvider } from "../../domain/ports/email-provider.port";
import {
  INotificationLogRepository,
  NotificationLogEntry,
} from "../../domain/ports/notification-log-repository.port";
import { ILogger } from "../../../../shared/kernel/logger.port";

export interface SendEmailInput {
  organizationId?: string | undefined;
  orderId?: string | undefined;
  eventType: string;
  recipientEmail: string;
  subject: string;
  text: string;
  outboxEventId?: string | undefined;
}

export class SendEmailUseCase {
  constructor(
    private readonly emailProvider: IEmailProvider,
    private readonly notificationLog: INotificationLogRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(input: SendEmailInput): Promise<void> {
    // Idempotency: prefer order-level deduplication; fall back to outbox-event-level
    if (input.orderId !== undefined) {
      const alreadySent = await this.notificationLog.hasBeenSent(input.orderId, input.eventType);
      if (alreadySent) {
        this.logger.log(
          `Notification already sent for orderId=${input.orderId} eventType=${input.eventType}, skipping`,
        );
        return;
      }
    } else if (input.outboxEventId !== undefined) {
      const alreadySent = await this.notificationLog.hasBeenSentForOutboxEvent(input.outboxEventId);
      if (alreadySent) {
        this.logger.log(
          `Notification already sent for outboxEventId=${input.outboxEventId} eventType=${input.eventType}, skipping`,
        );
        return;
      }
    }

    await this.emailProvider.send({
      to: input.recipientEmail,
      subject: input.subject,
      text: input.text,
    });

    const entry: NotificationLogEntry = {
      eventType: input.eventType,
      recipientEmail: input.recipientEmail,
    };
    if (input.organizationId !== undefined) entry.organizationId = input.organizationId;
    if (input.orderId !== undefined) entry.orderId = input.orderId;
    if (input.outboxEventId !== undefined) entry.outboxEventId = input.outboxEventId;

    await this.notificationLog.record(entry);

    this.logger.log(
      `Email sent to ${input.recipientEmail} for orderId=${input.orderId ?? "N/A"} eventType=${input.eventType}`,
    );
  }
}
