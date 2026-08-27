import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { PrismaService } from '../../platform/database/prisma.service';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PaymentsInfrastructureModule } from './infrastructure/payments.infrastructure.module';
import { TicketsModule } from '../tickets/tickets.module';
import { FinanceModule } from '../finance/finance.module';
import { CreatePaymentAttemptUseCase } from './application/use-cases/create-payment-attempt.use-case';
import { GetPaymentAttemptUseCase } from './application/use-cases/get-payment-attempt.use-case';
import { ProcessPaymentWebhookUseCase } from './application/use-cases/process-payment-webhook.use-case';
import { ProcessRefundUseCase } from './application/use-cases/process-refund.use-case';
import { ProcessChargebackUseCase } from './application/use-cases/process-chargeback.use-case';
import { PublicPaymentsController } from './presentation/controllers/public-payments.controller';
import { PaymentWebhookController } from './presentation/controllers/payment-webhook.controller';
import { OrderRefundController } from './presentation/controllers/order-refund.controller';
import { PAYMENT_GATEWAY_PORT, PaymentGatewayPort } from './domain/ports/payment-gateway.port';
import { PAYMENT_ATTEMPT_REPOSITORY, IPaymentAttemptRepository } from './domain/ports/payment-attempt-repository.port';
import { ORDER_ACCESS_PORT, IOrderAccessPort } from './application/ports/order-access.port';
import { PAYMENT_ATTEMPT_OPERATION_PORT, IPaymentAttemptOperationPort } from './application/ports/payment-attempt-operation.port';
import { PrismaPaymentAttemptOperationAdapter } from './infrastructure/adapters/prisma-payment-attempt-operation.adapter';
import { PAYMENT_WEBHOOK_OPERATION_PORT, IPaymentWebhookOperationPort } from './application/ports/payment-webhook-operation.port';
import { PrismaPaymentWebhookOperationAdapter } from './infrastructure/adapters/prisma-payment-webhook-operation.adapter';
import { PAYMENT_CHARGEBACK_OPERATION_PORT, IPaymentChargebackOperationPort } from './application/ports/payment-chargeback-operation.port';
import { PrismaPaymentChargebackOperationAdapter } from './infrastructure/adapters/prisma-payment-chargeback-operation.adapter';
import { PAYMENT_REFUND_OPERATION_PORT, IPaymentRefundOperationPort } from './application/ports/payment-refund-operation.port';
import { PrismaPaymentRefundOperationAdapter } from './infrastructure/adapters/prisma-payment-refund-operation.adapter';
import { FINANCIAL_RECORD_PORT, IFinancialRecordPort } from '../finance/contracts/financial-record.contract';

@Module({
  imports: [HttpModule, PaymentsInfrastructureModule, TicketsModule, FinanceModule, OrganizationsModule],
  controllers: [PublicPaymentsController, PaymentWebhookController, OrderRefundController],
  providers: [
    OrganizationRoleGuard,
    PrismaPaymentAttemptOperationAdapter,
    { provide: PAYMENT_ATTEMPT_OPERATION_PORT, useExisting: PrismaPaymentAttemptOperationAdapter },
    {
      provide: PAYMENT_CHARGEBACK_OPERATION_PORT,
      useFactory: (prisma: PrismaService, financialRecord: IFinancialRecordPort) =>
        new PrismaPaymentChargebackOperationAdapter(
          prisma,
          financialRecord,
          new NestLoggerAdapter('PrismaPaymentChargebackOperationAdapter'),
        ),
      inject: [PrismaService, FINANCIAL_RECORD_PORT],
    },
    {
      provide: PAYMENT_WEBHOOK_OPERATION_PORT,
      useFactory: (
        gateway: PaymentGatewayPort,
        prisma: PrismaService,
        chargebackOperation: IPaymentChargebackOperationPort,
        financialRecord: IFinancialRecordPort,
      ) =>
        new PrismaPaymentWebhookOperationAdapter(
          gateway,
          prisma,
          chargebackOperation,
          financialRecord,
          new NestLoggerAdapter('PrismaPaymentWebhookOperationAdapter'),
        ),
      inject: [
        PAYMENT_GATEWAY_PORT,
        PrismaService,
        PAYMENT_CHARGEBACK_OPERATION_PORT,
        FINANCIAL_RECORD_PORT,
      ],
    },
    {
      provide: PAYMENT_REFUND_OPERATION_PORT,
      useFactory: (
        gateway: PaymentGatewayPort,
        prisma: PrismaService,
        financialRecord: IFinancialRecordPort,
      ) =>
        new PrismaPaymentRefundOperationAdapter(
          gateway,
          prisma,
          financialRecord,
          new NestLoggerAdapter('PrismaPaymentRefundOperationAdapter'),
        ),
      inject: [PAYMENT_GATEWAY_PORT, PrismaService, FINANCIAL_RECORD_PORT],
    },
    {
      provide: CreatePaymentAttemptUseCase,
      useFactory: (gateway: PaymentGatewayPort, repo: IPaymentAttemptRepository, orderAccess: IOrderAccessPort, operation: IPaymentAttemptOperationPort): CreatePaymentAttemptUseCase =>
        new CreatePaymentAttemptUseCase(gateway, repo, orderAccess, operation),
      inject: [PAYMENT_GATEWAY_PORT, PAYMENT_ATTEMPT_REPOSITORY, ORDER_ACCESS_PORT, PAYMENT_ATTEMPT_OPERATION_PORT],
    },
    {
      provide: GetPaymentAttemptUseCase,
      useFactory: (repo: IPaymentAttemptRepository, orderAccess: IOrderAccessPort): GetPaymentAttemptUseCase =>
        new GetPaymentAttemptUseCase(repo, orderAccess),
      inject: [PAYMENT_ATTEMPT_REPOSITORY, ORDER_ACCESS_PORT],
    },
    {
      provide: ProcessChargebackUseCase,
      useFactory: (operation: IPaymentChargebackOperationPort): ProcessChargebackUseCase =>
        new ProcessChargebackUseCase(operation),
      inject: [PAYMENT_CHARGEBACK_OPERATION_PORT],
    },
    {
      provide: ProcessPaymentWebhookUseCase,
      useFactory: (operation: IPaymentWebhookOperationPort): ProcessPaymentWebhookUseCase =>
        new ProcessPaymentWebhookUseCase(operation),
      inject: [PAYMENT_WEBHOOK_OPERATION_PORT],
    },
    {
      provide: ProcessRefundUseCase,
      useFactory: (operation: IPaymentRefundOperationPort): ProcessRefundUseCase =>
        new ProcessRefundUseCase(operation),
      inject: [PAYMENT_REFUND_OPERATION_PORT],
    },
  ],
  exports: [
    PaymentsInfrastructureModule,
    CreatePaymentAttemptUseCase,
    ProcessPaymentWebhookUseCase,
    ProcessRefundUseCase,
    ProcessChargebackUseCase,
  ],
})
export class PaymentsModule {}
