import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  SELLER_BALANCE_REPOSITORY,
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';

export interface GetFinancialSummaryInput {
  organizationId: string;
  from: Date;
  to: Date;
}

export interface FinancialSummaryResult {
  grossSales: string;
  platformFees: string;
  refunds: string;
  netSales: string;
  pendingAmount: string;
  availableAmount: string;
  reservedAmount: string;
  currency: string;
}

interface RawSummaryRow {
  gross_sales: bigint;
  platform_fees: bigint;
  refunds: bigint;
  net_sales: bigint;
}

@Injectable()
export class GetFinancialSummaryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SELLER_BALANCE_REPOSITORY)
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
  ) {}

  async execute(input: GetFinancialSummaryInput): Promise<FinancialSummaryResult> {
    const { organizationId, from, to } = input;

    // Aggregate ledger entries by source_type via CASE pivot
    // gross_sales   = SUM of CREDIT entries for ORDER_PAID transactions
    // platform_fees = SUM of DEBIT entries on PLATFORM_FEE accounts for ORDER_PAID
    // refunds       = SUM of DEBIT entries on SELLER_PAYABLE accounts for REFUND/CHARGEBACK
    // net_sales     = gross_sales - platform_fees - refunds
    const client = this.prisma as unknown as PrismaClient;
    const rows = await client.$queryRaw<RawSummaryRow[]>`
      SELECT
        COALESCE(SUM(
          CASE WHEN lt.source_type = 'ORDER_PAID' AND le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END
        ), 0)::bigint AS gross_sales,
        COALESCE(SUM(
          CASE WHEN lt.source_type = 'ORDER_PAID' AND le.entry_type = 'DEBIT'
               AND la.code LIKE 'PLATFORM_FEE%' THEN le.amount ELSE 0 END
        ), 0)::bigint AS platform_fees,
        COALESCE(SUM(
          CASE WHEN lt.source_type IN ('REFUND','CHARGEBACK') AND le.entry_type = 'DEBIT'
               AND la.code LIKE 'SELLER_PAYABLE%' THEN le.amount ELSE 0 END
        ), 0)::bigint AS refunds,
        COALESCE(SUM(
          CASE WHEN lt.source_type = 'ORDER_PAID' AND le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END
        ) -
        SUM(
          CASE WHEN lt.source_type = 'ORDER_PAID' AND le.entry_type = 'DEBIT'
               AND la.code LIKE 'PLATFORM_FEE%' THEN le.amount ELSE 0 END
        ) -
        SUM(
          CASE WHEN lt.source_type IN ('REFUND','CHARGEBACK') AND le.entry_type = 'DEBIT'
               AND la.code LIKE 'SELLER_PAYABLE%' THEN le.amount ELSE 0 END
        ), 0)::bigint AS net_sales
      FROM ledger_entries le
      JOIN ledger_transactions lt ON lt.id = le.ledger_transaction_id
      JOIN ledger_accounts la ON la.id = le.account_id
      WHERE la.organization_id = ${organizationId}::uuid
        AND le.occurred_at >= ${from}
        AND le.occurred_at <= ${to}
    `;

    const row = rows[0];
    const grossSales = row?.gross_sales ?? 0n;
    const platformFees = row?.platform_fees ?? 0n;
    const refunds = row?.refunds ?? 0n;
    const netSales = row?.net_sales ?? 0n;

    const balance = await this.sellerBalanceRepo.findByOrg(organizationId);

    return {
      grossSales: grossSales.toString(),
      platformFees: platformFees.toString(),
      refunds: refunds.toString(),
      netSales: netSales.toString(),
      pendingAmount: (balance?.pendingAmount ?? 0n).toString(),
      availableAmount: (balance?.availableAmount ?? 0n).toString(),
      reservedAmount: (balance?.reservedAmount ?? 0n).toString(),
      currency: balance?.currency ?? 'BRL',
    };
  }
}
