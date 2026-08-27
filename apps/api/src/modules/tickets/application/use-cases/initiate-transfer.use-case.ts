import * as crypto from 'node:crypto';
import {
  ITicketTransferRepository,
} from '../../domain/ports/ticket-transfer-repository.port';
import {
  ITicketOrderAccessPort,
} from '../ports/ticket-order-access.port';
import {
  ITicketRepository,
} from '../../domain/ports/ticket-repository.port';
import {
  ICheckInAccessForTransferPort,
} from '../ports/check-in-access-for-transfer.port';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import {
  TicketAlreadyAdmittedError,
  TicketCancelledForTransferError,
  TransferAlreadyPendingError,
} from '../../domain/ticket-transfer.errors';

export interface InitiateTransferInput {
  orderId: string;
  ticketId: string;
  reservationToken: string;
}

export interface InitiateTransferResult {
  claimToken: string;
  expiresAt: Date;
}

export class InitiateTransferUseCase {
  constructor(
    private readonly transferRepo: ITicketTransferRepository,
    private readonly orderAccess: ITicketOrderAccessPort,
    private readonly ticketRepo: ITicketRepository,
    private readonly checkInAccess: ICheckInAccessForTransferPort,
  ) {}

  async execute(input: InitiateTransferInput): Promise<InitiateTransferResult> {
    // Validate order ownership via reservation token
    const order = await this.orderAccess.findOrderWithToken(input.orderId, input.reservationToken);
    if (!order) throw new TicketInvalidTokenError();

    // Verify ticket belongs to this order
    const tickets = await this.ticketRepo.findByOrderId(input.orderId, order.organizationId);
    const ticket = tickets.find((t) => t.id === input.ticketId);
    if (!ticket) throw new TicketInvalidTokenError();

    // Cancelled tickets cannot be transferred
    if (ticket.status === 'CANCELLED') throw new TicketCancelledForTransferError(input.ticketId);

    // Check if ticket has been admitted
    const admitted = await this.checkInAccess.hasAdmittedCheckIn(input.ticketId);
    if (admitted) throw new TicketAlreadyAdmittedError(input.ticketId);

    // Check for existing pending transfer
    const existing = await this.transferRepo.findPendingByTicketId(
      input.ticketId,
      order.organizationId,
    );
    if (existing) throw new TransferAlreadyPendingError(input.ticketId);

    // Generate claim token — plaintext returned to caller, hash persisted
    const claimToken = crypto.randomBytes(32).toString('hex');
    const claimTokenHash = crypto.createHash('sha256').update(claimToken).digest('hex');
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const transfer = await this.transferRepo.create({
      id,
      ticketId: input.ticketId,
      organizationId: order.organizationId,
      claimTokenHash,
      expiresAt,
    });

    return { claimToken, expiresAt: transfer.expiresAt };
  }
}
