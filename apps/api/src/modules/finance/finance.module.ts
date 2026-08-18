import { Module } from '@nestjs/common';
import { FEE_POLICY_REPOSITORY } from './domain/ports/fee-policy.repository.port';
import { ORDER_PRICING_SNAPSHOT_REPOSITORY } from './domain/ports/order-pricing-snapshot.repository.port';
import { FINANCIAL_RECORD_PORT } from './domain/ports/financial-record.port';
import { CalculateOrderPricingUseCase } from './application/use-cases/calculate-order-pricing.use-case';
import { RecordSaleUseCase } from './application/use-cases/record-sale.use-case';
import { PrismaFeePolicyRepository } from './infrastructure/repositories/prisma-fee-policy.repository';
import { PrismaOrderPricingSnapshotRepository } from './infrastructure/repositories/prisma-order-pricing-snapshot.repository';
import { FinancialRecordAdapter } from './infrastructure/adapters/financial-record.adapter';

@Module({
  providers: [
    // Domain use cases
    CalculateOrderPricingUseCase,
    RecordSaleUseCase,

    // Infrastructure: repositories
    PrismaFeePolicyRepository,
    PrismaOrderPricingSnapshotRepository,

    // Infrastructure: adapters
    FinancialRecordAdapter,

    // Port bindings
    { provide: FEE_POLICY_REPOSITORY, useExisting: PrismaFeePolicyRepository },
    { provide: ORDER_PRICING_SNAPSHOT_REPOSITORY, useExisting: PrismaOrderPricingSnapshotRepository },
    { provide: FINANCIAL_RECORD_PORT, useExisting: FinancialRecordAdapter },
  ],
  exports: [FINANCIAL_RECORD_PORT],
})
export class FinanceModule {}
