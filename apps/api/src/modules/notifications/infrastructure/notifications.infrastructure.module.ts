import { Module } from "@nestjs/common";
import { MailpitEmailAdapter } from "./adapters/mailpit-email.adapter";
import { PrismaNotificationLogRepository } from "./repositories/prisma-notification-log.repository";
import { OutboxNotificationWorker } from "./workers/outbox-notification.worker";
import { EMAIL_PROVIDER } from "../domain/ports/email-provider.port";
import { NOTIFICATION_LOG_REPOSITORY } from "../domain/ports/notification-log-repository.port";
import { SendEmailUseCase } from "../application/use-cases/send-email.use-case";

// SendEmailUseCase is co-located here because OutboxNotificationWorker (also in this module)
// depends on it, and NestJS module injection requires the provider to be in the same module
// context. NotificationsModule re-exports SendEmailUseCase for external consumers.
@Module({
  providers: [
    MailpitEmailAdapter,
    PrismaNotificationLogRepository,
    SendEmailUseCase,
    OutboxNotificationWorker,
    { provide: EMAIL_PROVIDER, useExisting: MailpitEmailAdapter },
    { provide: NOTIFICATION_LOG_REPOSITORY, useExisting: PrismaNotificationLogRepository },
  ],
  exports: [
    MailpitEmailAdapter,
    PrismaNotificationLogRepository,
    SendEmailUseCase,
    OutboxNotificationWorker,
    EMAIL_PROVIDER,
    NOTIFICATION_LOG_REPOSITORY,
  ],
})
export class NotificationsInfrastructureModule {}
