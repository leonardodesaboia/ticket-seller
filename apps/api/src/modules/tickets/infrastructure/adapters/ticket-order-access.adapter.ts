import * as crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { ITicketOrderAccessPort, OrderForTicketAccess } from '../../application/ports/ticket-order-access.port';

@Injectable()
export class TicketOrderAccessAdapter implements ITicketOrderAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderWithToken(orderId: string, token: string): Promise<OrderForTicketAccess | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await this.prisma.$queryRaw<Array<{
      id: string; organization_id: string; status: string;
    }>>`
      SELECT o.id, o.organization_id, o.status
      FROM orders o
      JOIN reservations r ON r.id = o.reservation_id
      WHERE o.id = ${orderId}::uuid
        AND r.continuation_token_hash = ${tokenHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, organizationId: row.organization_id, status: row.status };
  }
}
