import { Module } from '@nestjs/common';
import { NotificationsInfrastructureModule } from './infrastructure/notifications.infrastructure.module';

// SendEmailUseCase is provided and exported from NotificationsInfrastructureModule.
// Re-exporting the infrastructure module makes SendEmailUseCase available to all
// consumers of NotificationsModule without duplicating provider registrations.
@Module({
  imports: [NotificationsInfrastructureModule],
  exports: [NotificationsInfrastructureModule],
})
export class NotificationsModule {}
