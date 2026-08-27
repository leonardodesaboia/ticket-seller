import { Module } from '@nestjs/common';
import { NotificationsInfrastructureModule } from './infrastructure/notifications.infrastructure.module';
import { SendEmailUseCase } from './application/use-cases/send-email.use-case';
import { OutboxNotificationWorker } from './infrastructure/workers/outbox-notification.worker';
import { LOGGER } from '../../shared/kernel/logger.port';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';
import { EMAIL_PROVIDER, IEmailProvider } from './domain/ports/email-provider.port';
import { INotificationLogRepository, NOTIFICATION_LOG_REPOSITORY } from './domain/ports/notification-log-repository.port';
import { ILogger } from '../../shared/kernel/logger.port';

@Module({
  imports: [NotificationsInfrastructureModule],
  providers: [
    {
      provide: LOGGER,
      useFactory: (): ILogger => new NestLoggerAdapter('SendEmailUseCase'),
    },
    {
      provide: SendEmailUseCase,
      useFactory: (emailProvider: IEmailProvider, logRepo: INotificationLogRepository, logger: ILogger): SendEmailUseCase =>
        new SendEmailUseCase(emailProvider, logRepo, logger),
      inject: [EMAIL_PROVIDER, NOTIFICATION_LOG_REPOSITORY, LOGGER],
    },
    OutboxNotificationWorker,
  ],
  exports: [SendEmailUseCase],
})
export class NotificationsModule {}
