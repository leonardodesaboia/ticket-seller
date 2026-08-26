import { Module } from '@nestjs/common';
import { env } from '../../../platform/config/env';
import { FakePaymentGateway } from './adapters/fake/fake-payment.gateway';
import { PAYMENT_GATEWAY_PORT } from '../domain/ports/payment-gateway.port';
import { PAYMENT_ATTEMPT_REPOSITORY } from '../domain/ports/payment-attempt-repository.port';
import { PrismaPaymentAttemptRepository } from './repositories/prisma-payment-attempt.repository';
import { ORDER_ACCESS_PORT } from '../application/ports/order-access.port';
import { OrderAccessAdapter } from './adapters/order-access.adapter';

@Module({
  providers: [
    FakePaymentGateway,
    PrismaPaymentAttemptRepository,
    OrderAccessAdapter,
    {
      provide: PAYMENT_GATEWAY_PORT,
      inject: [FakePaymentGateway],
      useFactory: (fakePaymentGateway: FakePaymentGateway) => {
        if (env.PAYMENT_PROVIDER === 'fake') {
          return fakePaymentGateway;
        }

        throw new Error(`Unsupported PAYMENT_PROVIDER: ${env.PAYMENT_PROVIDER}`);
      },
    },
    { provide: PAYMENT_ATTEMPT_REPOSITORY, useExisting: PrismaPaymentAttemptRepository },
    { provide: ORDER_ACCESS_PORT, useExisting: OrderAccessAdapter },
  ],
  exports: [
    FakePaymentGateway,
    PrismaPaymentAttemptRepository,
    OrderAccessAdapter,
    PAYMENT_GATEWAY_PORT,
    PAYMENT_ATTEMPT_REPOSITORY,
    ORDER_ACCESS_PORT,
  ],
})
export class PaymentsInfrastructureModule {}
