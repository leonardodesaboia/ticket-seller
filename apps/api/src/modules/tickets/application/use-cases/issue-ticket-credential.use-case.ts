import * as crypto from 'node:crypto';
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
import { TicketCredential } from '../../domain/ticket-credential.entity';
import { TicketCancelledError } from '../../domain/ticket-credential.errors';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';

export interface IssueTicketCredentialInput {
  orderId: string;
  ticketId: string;
  reservationToken: string;
}

export interface IssueTicketCredentialResult {
  credentialToken: string; // plaintext — never stored
  credential: TicketCredential;
}

@Injectable()
export class IssueTicketCredentialUseCase {
  constructor(
    @Inject(TICKET_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo: ITicketCredentialRepository,
    @Inject(TICKET_ORDER_ACCESS_PORT)
    private readonly orderAccess: ITicketOrderAccessPort,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
  ) {}

  async execute(input: IssueTicketCredentialInput): Promise<IssueTicketCredentialResult> {
    // Validate order ownership via reservation token
    const order = await this.orderAccess.findOrderWithToken(input.orderId, input.reservationToken);
    if (!order) throw new TicketInvalidTokenError();

    // Verify ticket belongs to this order
    const tickets = await this.ticketRepo.findByOrderId(input.orderId, order.organizationId);
    const ticket = tickets.find((t) => t.id === input.ticketId);
    if (!ticket) throw new TicketInvalidTokenError();

    if (ticket.status === 'CANCELLED') throw new TicketCancelledError(input.ticketId);

    // Each POST always emits a fresh token — rotate if active credential exists
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const id = crypto.randomUUID();

    const existing = await this.credentialRepo.findActiveByTicketId(
      input.ticketId,
      order.organizationId,
    );
    const version = existing ? existing.version + 1 : 1;

    const credential = existing
      ? await this.credentialRepo.rotateCredential(input.ticketId, order.organizationId, {
          id,
          ticketId: input.ticketId,
          organizationId: order.organizationId,
          tokenHash,
          version,
        })
      : (await this.credentialRepo.createIfNoneActive({
          id,
          ticketId: input.ticketId,
          organizationId: order.organizationId,
          tokenHash,
          version,
        })) ??
        (await this.credentialRepo.rotateCredential(input.ticketId, order.organizationId, {
          id,
          ticketId: input.ticketId,
          organizationId: order.organizationId,
          tokenHash,
          version,
        }));

    return { credentialToken: token, credential };
  }
}
