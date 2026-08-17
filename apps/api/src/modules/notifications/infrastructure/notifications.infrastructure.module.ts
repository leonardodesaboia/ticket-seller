import { Module } from "@nestjs/common";
import { MailpitEmailAdapter } from "./adapters/mailpit-email.adapter";
import { PrismaNotificationLogRepository } from "./repositories/prisma-notification-log.repository";
import { EMAIL_PROVIDER } from "../domain/ports/email-provider.port";
import { NOTIFICATION_LOG_REPOSITORY } from "../domain/ports/notification-log-repository.port";

@Module({
  providers: [
    MailpitEmailAdapter,
    PrismaNotificationLogRepository,
    { provide: EMAIL_PROVIDER, useExisting: MailpitEmailAdapter },
    { provide: NOTIFICATION_LOG_REPOSITORY, useExisting: PrismaNotificationLogRepository },
  ],
  exports: [
    MailpitEmailAdapter,
    PrismaNotificationLogRepository,
    EMAIL_PROVIDER,
    NOTIFICATION_LOG_REPOSITORY,
  ],
})
export class NotificationsInfrastructureModule {}
