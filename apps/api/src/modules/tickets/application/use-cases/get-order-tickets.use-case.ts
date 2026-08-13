import { Inject, Injectable } from '@nestjs/common';
import { TICKET_REPOSITORY, ITicketRepository } from '../../domain/ports/ticket-repository.port';
import { TICKET_ORDER_ACCESS_PORT, ITicketOrderAccessPort } from '../ports/ticket-order-access.port';
import { Ticket } from '../../domain/ticket.entity';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';

@Injectable()
export class GetOrderTicketsUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    @Inject(TICKET_ORDER_ACCESS_PORT)
    private readonly orderAccess: ITicketOrderAccessPort,
  ) {}

  async execute(orderId: string, reservationToken: string): Promise<Ticket[]> {
    const order = await this.orderAccess.findOrderWithToken(orderId, reservationToken);
    if (!order) {
      throw new TicketInvalidTokenError();
    }
    return this.ticketRepo.findByOrderId(orderId, order.organizationId);
  }
}
