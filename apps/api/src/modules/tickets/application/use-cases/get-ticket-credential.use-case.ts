import {
  ITicketCredentialRepository,
} from '../../domain/ports/ticket-credential-repository.port';
import {
  ITicketOrderAccessPort,
} from '../ports/ticket-order-access.port';
import { ITicketRepository } from '../../domain/ports/ticket-repository.port';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';

export class GetTicketCredentialUseCase {
  constructor(
    private readonly credentialRepo: ITicketCredentialRepository,
    private readonly orderAccess: ITicketOrderAccessPort,
    private readonly ticketRepo: ITicketRepository,
  ) {}

  // Returns nothing useful — credential token is one-time. GET just confirms a credential exists.
  // The real token must be obtained via POST (issue/rotate).
  async exists(orderId: string, ticketId: string, reservationToken: string): Promise<boolean> {
    const order = await this.orderAccess.findOrderWithToken(orderId, reservationToken);
    if (!order) throw new TicketInvalidTokenError();

    const tickets = await this.ticketRepo.findByOrderId(orderId, order.organizationId);
    if (!tickets.find((t) => t.id === ticketId)) throw new TicketInvalidTokenError();

    const cred = await this.credentialRepo.findActiveByTicketId(ticketId, order.organizationId);
    return cred !== null;
  }
}
