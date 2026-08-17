export interface NotificationLogEntry {
  organizationId?: string;
  orderId?: string;
  eventType: string;
  recipientEmail: string;
  outboxEventId?: string;
}

export interface INotificationLogRepository {
  hasBeenSent(orderId: string, eventType: string): Promise<boolean>;
  hasBeenSentForOutboxEvent(outboxEventId: string): Promise<boolean>;
  record(entry: NotificationLogEntry): Promise<void>;
}

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');
