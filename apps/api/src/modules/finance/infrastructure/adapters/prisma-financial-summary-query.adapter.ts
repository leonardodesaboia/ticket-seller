import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  IFinancialSummaryQueryPort,
  RawFinancialSummary,
} from '../../application/ports/financial-summary-query.port';

interface RawSummaryRow {
  gross_sales: bigint;
  platform_fees: bigint;
  refunds: bigint;
  net_sales: bigint;
}

@Injectable()
export class PrismaFinancialSummaryQueryAdapter implements IFinancialSummaryQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async query(params: {
    organizationId: string;
    from: Date;
    to: Date;
  }): Promise<RawFinancialSummary> {
    const { organizationId, from, to } = params;
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
    return {
      grossSales: row?.gross_sales ?? 0n,
      platformFees: row?.platform_fees ?? 0n,
      refunds: row?.refunds ?? 0n,
      netSales: row?.net_sales ?? 0n,
    };
  }
}
