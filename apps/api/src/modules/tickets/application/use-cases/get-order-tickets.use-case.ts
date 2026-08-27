import { ITicketRepository } from '../../domain/ports/ticket-repository.port';
import { ITicketOrderAccessPort } from '../ports/ticket-order-access.port';
import { Ticket } from '../../domain/ticket.entity';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';

export class GetOrderTicketsUseCase {
  constructor(
    private readonly ticketRepo: ITicketRepository,
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
