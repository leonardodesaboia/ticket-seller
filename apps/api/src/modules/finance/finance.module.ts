import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { OrganizationsModule } from '../organizations/organizations.module';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';
import { FEE_POLICY_REPOSITORY, IFeePolicyRepository } from './domain/ports/fee-policy.repository.port';
import { ORDER_PRICING_SNAPSHOT_REPOSITORY, IOrderPricingSnapshotRepository } from './domain/ports/order-pricing-snapshot.repository.port';
import { FINANCIAL_RECORD_PORT } from './domain/ports/financial-record.port';
import { LEDGER_REPOSITORY, ILedgerRepository } from './domain/ports/ledger.repository.port';
import { SELLER_BALANCE_REPOSITORY, ISellerBalanceRepository } from './domain/ports/seller-balance.repository.port';
import { SETTLEMENT_POLICY_PORT } from './domain/ports/settlement-policy.port';
import { PAYOUT_GATEWAY_PORT, IPayoutGatewayPort } from './domain/ports/payout-gateway.port';
import { PAYOUT_RECIPIENT_REPOSITORY, IPayoutRecipientRepository } from './domain/ports/payout-recipient.repository.port';
import { PAYOUT_REPOSITORY, IPayoutRepository } from './domain/ports/payout.repository.port';
import { FINANCE_TRANSACTION_RUNNER, IFinanceTransactionRunner } from './application/ports/finance-transaction-runner.port';
import { FINANCIAL_SUMMARY_QUERY_PORT, IFinancialSummaryQueryPort } from './application/ports/financial-summary-query.port';
import { LEDGER_TRANSACTION_LIST_QUERY_PORT, ILedgerTransactionListQueryPort } from './application/ports/ledger-transaction-list-query.port';
import { PAYOUT_LIST_QUERY_PORT, IPayoutListQueryPort } from './application/ports/payout-list-query.port';
import { ORDER_SETTLEMENT_QUERY_PORT, IOrderSettlementQueryPort } from './application/ports/order-settlement-query.port';
import { CalculateOrderPricingUseCase } from './application/use-cases/calculate-order-pricing.use-case';
import { RecordSaleUseCase } from './application/use-cases/record-sale.use-case';
import { RecordRefundUseCase } from './application/use-cases/record-refund.use-case';
import { RecordChargebackUseCase } from './application/use-cases/record-chargeback.use-case';
import { SettleOrderUseCase } from './application/use-cases/settle-order.use-case';
import { GetOrganizationBalanceUseCase } from './application/use-cases/get-organization-balance.use-case';
import { RegisterPayoutRecipientUseCase } from './application/use-cases/register-payout-recipient.use-case';
import { CreatePayoutUseCase } from './application/use-cases/create-payout.use-case';
import { ProcessPayoutWebhookUseCase } from './application/use-cases/process-payout-webhook.use-case';
import { GetFinancialSummaryUseCase } from './application/use-cases/get-financial-summary.use-case';
import { ListLedgerTransactionsUseCase } from './application/use-cases/list-ledger-transactions.use-case';
import { ListPayoutsUseCase } from './application/use-cases/list-payouts.use-case';
import { PrismaFeePolicyRepository } from './infrastructure/repositories/prisma-fee-policy.repository';
import { PrismaOrderPricingSnapshotRepository } from './infrastructure/repositories/prisma-order-pricing-snapshot.repository';
import { PrismaLedgerRepository } from './infrastructure/repositories/prisma-ledger.repository';
import { PrismaSellerBalanceRepository } from './infrastructure/repositories/prisma-seller-balance.repository';
import { PrismaPayoutRecipientRepository } from './infrastructure/repositories/prisma-payout-recipient.repository';
import { PrismaPayoutRepository } from './infrastructure/repositories/prisma-payout.repository';
import { FinancialRecordAdapter } from './infrastructure/adapters/financial-record.adapter';
import { FeePolicySettlementAdapter } from './infrastructure/adapters/fee-policy-settlement.adapter';
import { FakePayoutGateway } from './infrastructure/adapters/fake/fake-payout.gateway';
import { PrismaFinanceTransactionRunner } from './infrastructure/adapters/prisma-finance-transaction-runner.adapter';
import { PrismaFinancialSummaryQueryAdapter } from './infrastructure/adapters/prisma-financial-summary-query.adapter';
import { PrismaLedgerTransactionListQueryAdapter } from './infrastructure/adapters/prisma-ledger-transaction-list-query.adapter';
import { PrismaPayoutListQueryAdapter } from './infrastructure/adapters/prisma-payout-list-query.adapter';
import { PrismaOrderSettlementQueryAdapter } from './infrastructure/adapters/prisma-order-settlement-query.adapter';
import { SettlementWorker } from './infrastructure/workers/settlement.worker';
import { ReconciliationWorker } from './infrastructure/workers/reconciliation.worker';
import { FinanceController } from './presentation/controllers/finance.controller';
import { PayoutWebhookController } from './presentation/controllers/payout-webhook.controller';

@Module({
  imports: [HttpModule, OrganizationsModule],
  controllers: [FinanceController, PayoutWebhookController],
  providers: [
    OrganizationRoleGuard,
    // Infrastructure: repositories
    PrismaFeePolicyRepository,
    PrismaOrderPricingSnapshotRepository,
    PrismaLedgerRepository,
    PrismaSellerBalanceRepository,
    PrismaPayoutRecipientRepository,
    PrismaPayoutRepository,

    // Infrastructure: adapters
    FinancialRecordAdapter,
    FeePolicySettlementAdapter,
    FakePayoutGateway,
    PrismaFinanceTransactionRunner,
    PrismaFinancialSummaryQueryAdapter,
    PrismaLedgerTransactionListQueryAdapter,
    PrismaPayoutListQueryAdapter,
    PrismaOrderSettlementQueryAdapter,

    // Infrastructure: workers
    SettlementWorker,
    ReconciliationWorker,

    // Port bindings
    { provide: FEE_POLICY_REPOSITORY, useExisting: PrismaFeePolicyRepository },
    { provide: ORDER_PRICING_SNAPSHOT_REPOSITORY, useExisting: PrismaOrderPricingSnapshotRepository },
    { provide: LEDGER_REPOSITORY, useExisting: PrismaLedgerRepository },
    { provide: SELLER_BALANCE_REPOSITORY, useExisting: PrismaSellerBalanceRepository },
    { provide: PAYOUT_RECIPIENT_REPOSITORY, useExisting: PrismaPayoutRecipientRepository },
    { provide: PAYOUT_REPOSITORY, useExisting: PrismaPayoutRepository },
    { provide: FINANCIAL_RECORD_PORT, useExisting: FinancialRecordAdapter },
    { provide: SETTLEMENT_POLICY_PORT, useExisting: FeePolicySettlementAdapter },
    { provide: PAYOUT_GATEWAY_PORT, useExisting: FakePayoutGateway },
    { provide: FINANCE_TRANSACTION_RUNNER, useExisting: PrismaFinanceTransactionRunner },
    { provide: FINANCIAL_SUMMARY_QUERY_PORT, useExisting: PrismaFinancialSummaryQueryAdapter },
    { provide: LEDGER_TRANSACTION_LIST_QUERY_PORT, useExisting: PrismaLedgerTransactionListQueryAdapter },
    { provide: PAYOUT_LIST_QUERY_PORT, useExisting: PrismaPayoutListQueryAdapter },
    { provide: ORDER_SETTLEMENT_QUERY_PORT, useExisting: PrismaOrderSettlementQueryAdapter },

    // Application: pure use cases (factory providers — no @Injectable)
    {
      provide: CalculateOrderPricingUseCase,
      useFactory: () => new CalculateOrderPricingUseCase(),
    },
    {
      provide: RecordSaleUseCase,
      useFactory: (
        feePolicyRepo: IFeePolicyRepository,
        snapshotRepo: IOrderPricingSnapshotRepository,
        ledgerRepo: ILedgerRepository,
        balanceRepo: ISellerBalanceRepository,
        calculateOrderPricing: CalculateOrderPricingUseCase,
      ) =>
        new RecordSaleUseCase(
          feePolicyRepo,
          snapshotRepo,
          ledgerRepo,
          balanceRepo,
          calculateOrderPricing,
          new NestLoggerAdapter('RecordSaleUseCase'),
        ),
      inject: [
        FEE_POLICY_REPOSITORY,
        ORDER_PRICING_SNAPSHOT_REPOSITORY,
        LEDGER_REPOSITORY,
        SELLER_BALANCE_REPOSITORY,
        CalculateOrderPricingUseCase,
      ],
    },
    {
      provide: RecordChargebackUseCase,
      useFactory: (
        ledgerRepo: ILedgerRepository,
        balanceRepo: ISellerBalanceRepository,
        orderSettlementQuery: IOrderSettlementQueryPort,
      ) =>
        new RecordChargebackUseCase(
          ledgerRepo,
          balanceRepo,
          orderSettlementQuery,
          new NestLoggerAdapter('RecordChargebackUseCase'),
        ),
      inject: [LEDGER_REPOSITORY, SELLER_BALANCE_REPOSITORY, ORDER_SETTLEMENT_QUERY_PORT],
    },
    {
      provide: RecordRefundUseCase,
      useFactory: (
        snapshotRepo: IOrderPricingSnapshotRepository,
        ledgerRepo: ILedgerRepository,
        balanceRepo: ISellerBalanceRepository,
        orderSettlementQuery: IOrderSettlementQueryPort,
      ) =>
        new RecordRefundUseCase(
          snapshotRepo,
          ledgerRepo,
          balanceRepo,
          orderSettlementQuery,
          new NestLoggerAdapter('RecordRefundUseCase'),
        ),
      inject: [
        ORDER_PRICING_SNAPSHOT_REPOSITORY,
        LEDGER_REPOSITORY,
        SELLER_BALANCE_REPOSITORY,
        ORDER_SETTLEMENT_QUERY_PORT,
      ],
    },
    {
      provide: SettleOrderUseCase,
      useFactory: (
        transactionRunner: IFinanceTransactionRunner,
        balanceRepo: ISellerBalanceRepository,
      ) =>
        new SettleOrderUseCase(
          transactionRunner,
          balanceRepo,
          new NestLoggerAdapter('SettleOrderUseCase'),
        ),
      inject: [FINANCE_TRANSACTION_RUNNER, SELLER_BALANCE_REPOSITORY],
    },
    {
      provide: GetOrganizationBalanceUseCase,
      useFactory: (balanceRepo: ISellerBalanceRepository) =>
        new GetOrganizationBalanceUseCase(balanceRepo),
      inject: [SELLER_BALANCE_REPOSITORY],
    },
    {
      provide: RegisterPayoutRecipientUseCase,
      useFactory: (
        gateway: IPayoutGatewayPort,
        recipientRepo: IPayoutRecipientRepository,
      ) => new RegisterPayoutRecipientUseCase(gateway, recipientRepo),
      inject: [PAYOUT_GATEWAY_PORT, PAYOUT_RECIPIENT_REPOSITORY],
    },
    {
      provide: CreatePayoutUseCase,
      useFactory: (
        transactionRunner: IFinanceTransactionRunner,
        payoutRepo: IPayoutRepository,
        recipientRepo: IPayoutRecipientRepository,
        balanceRepo: ISellerBalanceRepository,
        ledgerRepo: ILedgerRepository,
        gateway: IPayoutGatewayPort,
      ) =>
        new CreatePayoutUseCase(
          transactionRunner,
          payoutRepo,
          recipientRepo,
          balanceRepo,
          ledgerRepo,
          gateway,
          new NestLoggerAdapter('CreatePayoutUseCase'),
        ),
      inject: [
        FINANCE_TRANSACTION_RUNNER,
        PAYOUT_REPOSITORY,
        PAYOUT_RECIPIENT_REPOSITORY,
        SELLER_BALANCE_REPOSITORY,
        LEDGER_REPOSITORY,
        PAYOUT_GATEWAY_PORT,
      ],
    },
    {
      provide: ProcessPayoutWebhookUseCase,
      useFactory: (
        transactionRunner: IFinanceTransactionRunner,
        payoutRepo: IPayoutRepository,
        balanceRepo: ISellerBalanceRepository,
        ledgerRepo: ILedgerRepository,
        gateway: IPayoutGatewayPort,
      ) =>
        new ProcessPayoutWebhookUseCase(
          transactionRunner,
          payoutRepo,
          balanceRepo,
          ledgerRepo,
          gateway,
          new NestLoggerAdapter('ProcessPayoutWebhookUseCase'),
        ),
      inject: [
        FINANCE_TRANSACTION_RUNNER,
        PAYOUT_REPOSITORY,
        SELLER_BALANCE_REPOSITORY,
        LEDGER_REPOSITORY,
        PAYOUT_GATEWAY_PORT,
      ],
    },
    {
      provide: GetFinancialSummaryUseCase,
      useFactory: (
        summaryQuery: IFinancialSummaryQueryPort,
        balanceRepo: ISellerBalanceRepository,
      ) => new GetFinancialSummaryUseCase(summaryQuery, balanceRepo),
      inject: [FINANCIAL_SUMMARY_QUERY_PORT, SELLER_BALANCE_REPOSITORY],
    },
    {
      provide: ListLedgerTransactionsUseCase,
      useFactory: (queryPort: ILedgerTransactionListQueryPort) =>
        new ListLedgerTransactionsUseCase(queryPort),
      inject: [LEDGER_TRANSACTION_LIST_QUERY_PORT],
    },
    {
      provide: ListPayoutsUseCase,
      useFactory: (queryPort: IPayoutListQueryPort) => new ListPayoutsUseCase(queryPort),
      inject: [PAYOUT_LIST_QUERY_PORT],
    },
  ],
  exports: [FINANCIAL_RECORD_PORT],
})
export class FinanceModule {}
