import { Module } from "@nestjs/common";
import { MailpitEmailAdapter } from "./adapters/mailpit-email.adapter";
import { ResendEmailAdapter } from "./adapters/resend-email.adapter";
import { PrismaNotificationLogRepository } from "./repositories/prisma-notification-log.repository";
import { EMAIL_PROVIDER } from "../domain/ports/email-provider.port";
import { NOTIFICATION_LOG_REPOSITORY } from "../domain/ports/notification-log-repository.port";
import { env } from "../../../platform/config/env";

const emailProviderFactory = {
  provide: EMAIL_PROVIDER,
  useFactory: (mailpit: MailpitEmailAdapter, resend: ResendEmailAdapter) => {
    return env.RESEND_API_KEY ? resend : mailpit;
  },
  inject: [MailpitEmailAdapter, ResendEmailAdapter],
};

@Module({
  providers: [
    MailpitEmailAdapter,
    ResendEmailAdapter,
    PrismaNotificationLogRepository,
    emailProviderFactory,
    { provide: NOTIFICATION_LOG_REPOSITORY, useExisting: PrismaNotificationLogRepository },
  ],
  exports: [
    EMAIL_PROVIDER,
    NOTIFICATION_LOG_REPOSITORY,
  ],
})
export class NotificationsInfrastructureModule {}
