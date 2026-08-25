import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { ORGANIZATION_INVITATION_REPOSITORY } from '../organizations/domain/ports/organization-invitation-repository.port';
import { PrismaOrganizationInvitationRepository } from '../organizations/infrastructure/repositories/prisma-organization-invitation.repository';
import { PaymentsInfrastructureModule } from './infrastructure/payments.infrastructure.module';
import { TicketsModule } from '../tickets/tickets.module';
import { FinanceModule } from '../finance/finance.module';
import { PAYMENT_GATEWAY_PORT } from './domain/ports/payment-gateway.port';
import { PAYMENT_ATTEMPT_REPOSITORY } from './domain/ports/payment-attempt-repository.port';
import { ORDER_ACCESS_PORT } from './application/ports/order-access.port';
import { CreatePaymentAttemptUseCase } from './application/use-cases/create-payment-attempt.use-case';
import { GetPaymentAttemptUseCase } from './application/use-cases/get-payment-attempt.use-case';
import { ProcessPaymentWebhookUseCase } from './application/use-cases/process-payment-webhook.use-case';
import { ProcessRefundUseCase } from './application/use-cases/process-refund.use-case';
import { ProcessChargebackUseCase } from './application/use-cases/process-chargeback.use-case';
import { PublicPaymentsController } from './presentation/controllers/public-payments.controller';
import { PaymentWebhookController } from './presentation/controllers/payment-webhook.controller';
import { OrderRefundController } from './presentation/controllers/order-refund.controller';
import { FakePaymentGateway } from './infrastructure/adapters/fake/fake-payment.gateway';
import { PrismaPaymentAttemptRepository } from './infrastructure/repositories/prisma-payment-attempt.repository';
import { OrderAccessAdapter } from './infrastructure/adapters/order-access.adapter';

@Module({
  imports: [HttpModule, PaymentsInfrastructureModule, TicketsModule, FinanceModule],
  controllers: [PublicPaymentsController, PaymentWebhookController, OrderRefundController],
  providers: [
    OrganizationRoleGuard,
    { provide: ORGANIZATION_INVITATION_REPOSITORY, useClass: PrismaOrganizationInvitationRepository },
    CreatePaymentAttemptUseCase,
    GetPaymentAttemptUseCase,
    ProcessChargebackUseCase,
    ProcessPaymentWebhookUseCase,
    ProcessRefundUseCase,
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
    ProcessRefundUseCase,
    ProcessChargebackUseCase,
  ],
})
export class PaymentsModule {}
