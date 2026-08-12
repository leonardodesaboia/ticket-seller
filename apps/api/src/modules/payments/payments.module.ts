import { Module } from '@nestjs/common';
import { PaymentsInfrastructureModule } from './infrastructure/payments.infrastructure.module';
import { PAYMENT_GATEWAY_PORT } from './domain/ports/payment-gateway.port';

@Module({
  imports: [PaymentsInfrastructureModule],
  exports: [PAYMENT_GATEWAY_PORT],
})
export class PaymentsModule {}
