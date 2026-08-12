import { Module } from '@nestjs/common';
import { PaymentsInfrastructureModule } from './infrastructure/payments.infrastructure.module';
import { PAYMENT_GATEWAY_PORT } from './domain/ports/payment-gateway.port';
import { PAYMENT_ATTEMPT_REPOSITORY } from './domain/ports/payment-attempt-repository.port';
import { ORDER_ACCESS_PORT } from './application/ports/order-access.port';
import { CreatePaymentAttemptUseCase } from './application/use-cases/create-payment-attempt.use-case';
import { GetPaymentAttemptUseCase } from './application/use-cases/get-payment-attempt.use-case';
import { ProcessPaymentWebhookUseCase } from './application/use-cases/process-payment-webhook.use-case';
import { PublicPaymentsController } from './presentation/controllers/public-payments.controller';
import { PaymentWebhookController } from './presentation/controllers/payment-webhook.controller';
import { FakePaymentGateway } from './infrastructure/adapters/fake/fake-payment.gateway';
import { PrismaPaymentAttemptRepository } from './infrastructure/repositories/prisma-payment-attempt.repository';
import { OrderAccessAdapter } from './infrastructure/adapters/order-access.adapter';

@Module({
  imports: [PaymentsInfrastructureModule],
  controllers: [PublicPaymentsController, PaymentWebhookController],
  providers: [
    CreatePaymentAttemptUseCase,
    GetPaymentAttemptUseCase,
    ProcessPaymentWebhookUseCase,
    { provide: PAYMENT_GATEWAY_PORT, useExisting: FakePaymentGateway },
    { provide: PAYMENT_ATTEMPT_REPOSITORY, useExisting: PrismaPaymentAttemptRepository },
    { provide: ORDER_ACCESS_PORT, useExisting: OrderAccessAdapter },
  ],
  exports: [
    PAYMENT_GATEWAY_PORT,
    PAYMENT_ATTEMPT_REPOSITORY,
    ORDER_ACCESS_PORT,
    CreatePaymentAttemptUseCase,
    ProcessPaymentWebhookUseCase,
  ],
})
export class PaymentsModule {}
