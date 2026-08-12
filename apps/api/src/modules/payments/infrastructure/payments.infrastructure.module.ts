import { Module } from '@nestjs/common';
import { FakePaymentGateway } from './adapters/fake/fake-payment.gateway';
import { PAYMENT_GATEWAY_PORT } from '../domain/ports/payment-gateway.port';

@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: FakePaymentGateway,
    },
  ],
  exports: [PAYMENT_GATEWAY_PORT],
})
export class PaymentsInfrastructureModule {}
