import * as crypto from 'node:crypto';
import {
  ITicketCredentialRepository,
} from '../../domain/ports/ticket-credential-repository.port';
import {
  ITicketOrderAccessPort,
} from '../ports/ticket-order-access.port';
import { ITicketRepository } from '../../domain/ports/ticket-repository.port';
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

export class IssueTicketCredentialUseCase {
  constructor(
    private readonly credentialRepo: ITicketCredentialRepository,
    private readonly orderAccess: ITicketOrderAccessPort,
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

    let credential: TicketCredential;

    if (existing) {
      credential = await this.credentialRepo.rotateCredential(input.ticketId, order.organizationId, {
        id,
        ticketId: input.ticketId,
        organizationId: order.organizationId,
        tokenHash,
        version: existing.version + 1,
      });
    } else {
      const created = await this.credentialRepo.createIfNoneActive({
        id,
        ticketId: input.ticketId,
        organizationId: order.organizationId,
        tokenHash,
        version: 1,
      });
      if (created) {
        credential = created;
      } else {
        // Race: another request created an active credential between our read and insert.
        // Re-fetch so we use the correct version number before rotating.
        const raceExisting = await this.credentialRepo.findActiveByTicketId(
          input.ticketId,
          order.organizationId,
        );
        credential = await this.credentialRepo.rotateCredential(input.ticketId, order.organizationId, {
          id,
          ticketId: input.ticketId,
          organizationId: order.organizationId,
          tokenHash,
          version: (raceExisting?.version ?? 0) + 1,
        });
      }
    }

    return { credentialToken: token, credential };
  }
}
