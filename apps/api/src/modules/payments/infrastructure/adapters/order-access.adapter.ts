import * as crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IOrderAccessPort, OrderForPayment } from '../../application/ports/order-access.port';

@Injectable()
export class OrderAccessAdapter implements IOrderAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderWithToken(orderId: string, token: string): Promise<OrderForPayment | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Join orders → reservations to get the continuation_token_hash
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        organization_id: string;
        reservation_id: string;
        continuation_token_hash: string;
        status: string;
        currency: string;
        total_amount: bigint;
        expires_at: Date;
      }>
    >`
      SELECT o.id, o.organization_id, o.reservation_id,
             r.continuation_token_hash,
             o.status, o.currency, o.total_amount, o.expires_at
      FROM orders o
      JOIN reservations r ON r.id = o.reservation_id
      WHERE o.id = ${orderId}::uuid
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    if (row.continuation_token_hash !== tokenHash) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      reservationId: row.reservation_id,
      continuationTokenHash: row.continuation_token_hash,
      status: row.status,
      currency: row.currency,
      totalAmount: BigInt(row.total_amount),
      expiresAt: row.expires_at,
    };
  }
}
