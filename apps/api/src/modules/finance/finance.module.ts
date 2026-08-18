import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { FEE_POLICY_REPOSITORY } from './domain/ports/fee-policy.repository.port';
import { ORDER_PRICING_SNAPSHOT_REPOSITORY } from './domain/ports/order-pricing-snapshot.repository.port';
import { FINANCIAL_RECORD_PORT } from './domain/ports/financial-record.port';
import { LEDGER_REPOSITORY } from './domain/ports/ledger.repository.port';
import { SELLER_BALANCE_REPOSITORY } from './domain/ports/seller-balance.repository.port';
import { SETTLEMENT_POLICY_PORT } from './domain/ports/settlement-policy.port';
import { PAYOUT_GATEWAY_PORT } from './domain/ports/payout-gateway.port';
import { PAYOUT_RECIPIENT_REPOSITORY } from './domain/ports/payout-recipient.repository.port';
import { CalculateOrderPricingUseCase } from './application/use-cases/calculate-order-pricing.use-case';
import { RecordSaleUseCase } from './application/use-cases/record-sale.use-case';
import { RecordRefundUseCase } from './application/use-cases/record-refund.use-case';
import { RecordChargebackUseCase } from './application/use-cases/record-chargeback.use-case';
import { SettleOrderUseCase } from './application/use-cases/settle-order.use-case';
import { GetOrganizationBalanceUseCase } from './application/use-cases/get-organization-balance.use-case';
import { RegisterPayoutRecipientUseCase } from './application/use-cases/register-payout-recipient.use-case';
import { PrismaFeePolicyRepository } from './infrastructure/repositories/prisma-fee-policy.repository';
import { PrismaOrderPricingSnapshotRepository } from './infrastructure/repositories/prisma-order-pricing-snapshot.repository';
import { PrismaLedgerRepository } from './infrastructure/repositories/prisma-ledger.repository';
import { PrismaSellerBalanceRepository } from './infrastructure/repositories/prisma-seller-balance.repository';
import { PrismaPayoutRecipientRepository } from './infrastructure/repositories/prisma-payout-recipient.repository';
import { FinancialRecordAdapter } from './infrastructure/adapters/financial-record.adapter';
import { FeePolicySettlementAdapter } from './infrastructure/adapters/fee-policy-settlement.adapter';
import { FakePayoutGateway } from './infrastructure/adapters/fake/fake-payout.gateway';
import { SettlementWorker } from './infrastructure/workers/settlement.worker';
import { FinanceController } from './presentation/controllers/finance.controller';

@Module({
  imports: [HttpModule],
  controllers: [FinanceController],
  providers: [
    // Domain use cases
    CalculateOrderPricingUseCase,
    RecordSaleUseCase,
    RecordRefundUseCase,
    RecordChargebackUseCase,
    SettleOrderUseCase,
    GetOrganizationBalanceUseCase,
    RegisterPayoutRecipientUseCase,

    // Infrastructure: repositories
    PrismaFeePolicyRepository,
    PrismaOrderPricingSnapshotRepository,
    PrismaLedgerRepository,
    PrismaSellerBalanceRepository,
    PrismaPayoutRecipientRepository,

    // Infrastructure: adapters
    FinancialRecordAdapter,
    FeePolicySettlementAdapter,
    FakePayoutGateway,

    // Infrastructure: workers
    SettlementWorker,

    // Port bindings
    { provide: FEE_POLICY_REPOSITORY, useExisting: PrismaFeePolicyRepository },
    { provide: ORDER_PRICING_SNAPSHOT_REPOSITORY, useExisting: PrismaOrderPricingSnapshotRepository },
    { provide: LEDGER_REPOSITORY, useExisting: PrismaLedgerRepository },
    { provide: SELLER_BALANCE_REPOSITORY, useExisting: PrismaSellerBalanceRepository },
    { provide: PAYOUT_RECIPIENT_REPOSITORY, useExisting: PrismaPayoutRecipientRepository },
    { provide: FINANCIAL_RECORD_PORT, useExisting: FinancialRecordAdapter },
    { provide: SETTLEMENT_POLICY_PORT, useExisting: FeePolicySettlementAdapter },
    { provide: PAYOUT_GATEWAY_PORT, useExisting: FakePayoutGateway },
  ],
  exports: [FINANCIAL_RECORD_PORT],
})
export class FinanceModule {}
