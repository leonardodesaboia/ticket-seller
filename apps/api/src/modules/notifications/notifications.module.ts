import { Module } from '@nestjs/common';
import { NotificationsInfrastructureModule } from './infrastructure/notifications.infrastructure.module';
import { SendEmailUseCase } from './application/use-cases/send-email.use-case';
import { OutboxNotificationWorker } from './infrastructure/workers/outbox-notification.worker';

@Module({
  imports: [NotificationsInfrastructureModule],
  providers: [SendEmailUseCase, OutboxNotificationWorker],
  exports: [SendEmailUseCase],
})
export class NotificationsModule {}
