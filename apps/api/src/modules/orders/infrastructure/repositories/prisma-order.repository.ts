import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { InvalidReservationTokenForOrderError, OrderNotFoundError } from '../../domain/order.errors';
import type { IOrderRepository, OrderView, OrderViewItem } from '../../domain/ports/order-repository.port';

interface OrderRow { id: string; reservation_id: string; status: string; currency: string; subtotal_amount: bigint; total_amount: bigint; expires_at: Date; continuation_token_hash: string; }
interface ItemRow { ticket_type_id: string; name_snapshot: string; quantity: number; unit_price_amount: bigint; subtotal_amount: bigint; }
function amount(value: bigint): number { const result = Number(value); if (!Number.isSafeInteger(result)) throw new Error('Order amount exceeds JavaScript safe integer range'); return result; }

@Injectable()
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(orderId: string, tokenHash: string): Promise<OrderView> {
    const rows = await this.prisma.$queryRaw<OrderRow[]>`
      SELECT o.id, o.reservation_id, o.status, o.currency, o.subtotal_amount, o.total_amount, o.expires_at, r.continuation_token_hash
      FROM orders o JOIN reservations r ON r.id = o.reservation_id WHERE o.id = ${orderId}::uuid LIMIT 1
    `;
    const order = rows[0];
    if (!order) throw new OrderNotFoundError();
    if (order.continuation_token_hash !== tokenHash) throw new InvalidReservationTokenForOrderError();
    const items = await this.prisma.$queryRaw<ItemRow[]>`SELECT ticket_type_id, name_snapshot, quantity, unit_price_amount, subtotal_amount FROM order_items WHERE order_id = ${orderId}::uuid ORDER BY ticket_type_id`;
    return { orderId: order.id, reservationId: order.reservation_id, status: order.status as OrderView['status'], currency: order.currency, subtotalAmount: amount(order.subtotal_amount), totalAmount: amount(order.total_amount), expiresAt: order.expires_at.toISOString(), items: items.map((item): OrderViewItem => ({ ticketTypeId: item.ticket_type_id, name: item.name_snapshot, quantity: item.quantity, unitPriceAmount: amount(item.unit_price_amount), subtotalAmount: amount(item.subtotal_amount) })) };
  }
}
