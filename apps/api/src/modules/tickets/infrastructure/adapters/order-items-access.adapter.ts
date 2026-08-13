import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IOrderItemsAccessPort, OrderForIssuance } from '../../application/ports/order-items-access.port';

@Injectable()
export class OrderItemsAccessAdapter implements IOrderItemsAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderWithItems(orderId: string): Promise<OrderForIssuance | null> {
    const orders = await this.prisma.$queryRaw<Array<{
      id: string; organization_id: string; event_id: string; status: string;
    }>>`
      SELECT id, organization_id, event_id, status FROM orders WHERE id = ${orderId}::uuid LIMIT 1
    `;
    const order = orders[0];
    if (!order) return null;

    const items = await this.prisma.$queryRaw<Array<{
      id: string; ticket_type_id: string; quantity: number;
    }>>`
      SELECT id, ticket_type_id, quantity FROM order_items WHERE order_id = ${orderId}::uuid
    `;

    return {
      id: order.id,
      organizationId: order.organization_id,
      eventId: order.event_id,
      status: order.status,
      items: items.map((i: { id: string; ticket_type_id: string; quantity: number }) => ({ id: i.id, ticketTypeId: i.ticket_type_id, quantity: i.quantity })),
    };
  }
}
