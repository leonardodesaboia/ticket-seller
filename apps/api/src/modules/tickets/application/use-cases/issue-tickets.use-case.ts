import * as crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { TICKET_REPOSITORY, ITicketRepository } from '../../domain/ports/ticket-repository.port';
import { ORDER_ITEMS_ACCESS_PORT, IOrderItemsAccessPort } from '../ports/order-items-access.port';
import { Ticket } from '../../domain/ticket.entity';

export interface IssueTicketsInput {
  orderId: string;
  organizationId: string;
  eventId: string;
  items: Array<{ orderItemId: string; ticketTypeId: string; quantity: number }>;
}

@Injectable()
export class IssueTicketsUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    @Inject(ORDER_ITEMS_ACCESS_PORT)
    private readonly orderItemsAccess: IOrderItemsAccessPort,
  ) {}

  async executeForOrder(orderId: string): Promise<Ticket[]> {
    const order = await this.orderItemsAccess.findOrderWithItems(orderId);
    if (!order) return [];
    if (order.status !== 'PAID' && order.status !== 'TICKETS_ISSUED') return [];

    return this.executeWithItems({
      orderId: order.id,
      organizationId: order.organizationId,
      eventId: order.eventId,
      items: order.items.map((i) => ({
        orderItemId: i.id,
        ticketTypeId: i.ticketTypeId,
        quantity: i.quantity,
      })),
    });
  }

  async executeWithItems(input: IssueTicketsInput): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const item of input.items) {
      for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
        const publicCode = crypto.randomBytes(32).toString('hex');
        const id = crypto.randomUUID();

        const ticket = await this.ticketRepo.createIfNotExists({
          id,
          organizationId: input.organizationId,
          eventId: input.eventId,
          orderId: input.orderId,
          orderItemId: item.orderItemId,
          ticketTypeId: item.ticketTypeId,
          unitIndex,
          publicCode,
        });

        if (ticket) tickets.push(ticket);
      }
    }

    return tickets;
  }
}
