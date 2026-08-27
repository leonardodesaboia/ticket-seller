import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IOrderSettlementQueryPort } from '../../application/ports/order-settlement-query.port';

type TxClient = { $queryRaw: PrismaService['$queryRaw'] };

@Injectable()
export class PrismaOrderSettlementQueryAdapter implements IOrderSettlementQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async isOrderSettled(orderId: string, tx?: unknown): Promise<boolean> {
    const client: TxClient = (tx as TxClient | undefined) ?? this.prisma;
    const rows = await client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM balance_settlements
      WHERE order_id = ${orderId}::uuid
    `;
    return Number(rows[0]?.count ?? 0n) > 0;
  }
}
