import { Module } from '@nestjs/common';
import { NotificationsInfrastructureModule } from './infrastructure/notifications.infrastructure.module';
import { SendEmailUseCase } from './application/use-cases/send-email.use-case';

@Module({
  imports: [NotificationsInfrastructureModule],
  providers: [SendEmailUseCase],
  exports: [SendEmailUseCase],
})
export class NotificationsModule {}
