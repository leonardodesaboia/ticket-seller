import { Inject, Injectable } from '@nestjs/common';
import {
  TICKET_CREDENTIAL_REPOSITORY,
  ITicketCredentialRepository,
} from '../../domain/ports/ticket-credential-repository.port';
import {
  TICKET_ORDER_ACCESS_PORT,
  ITicketOrderAccessPort,
} from '../ports/ticket-order-access.port';
import { TICKET_REPOSITORY, ITicketRepository } from '../../domain/ports/ticket-repository.port';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';

@Injectable()
export class GetTicketCredentialUseCase {
  constructor(
    @Inject(TICKET_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo: ITicketCredentialRepository,
    @Inject(TICKET_ORDER_ACCESS_PORT)
    private readonly orderAccess: ITicketOrderAccessPort,
    @Inject(TICKET_REPOSITORY)
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
