import {
  ITicketTransferRepository,
} from '../../domain/ports/ticket-transfer-repository.port';
import {
  ITicketOrderAccessPort,
} from '../ports/ticket-order-access.port';
import {
  ITicketRepository,
} from '../../domain/ports/ticket-repository.port';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { TransferNotFoundError } from '../../domain/ticket-transfer.errors';

export interface CancelTransferInput {
  orderId: string;
  ticketId: string;
  reservationToken: string;
}

export class CancelTransferUseCase {
  constructor(
    private readonly transferRepo: ITicketTransferRepository,
    private readonly orderAccess: ITicketOrderAccessPort,
    private readonly ticketRepo: ITicketRepository,
  ) {}

  async execute(input: CancelTransferInput): Promise<void> {
    // Validate order ownership via reservation token
    const order = await this.orderAccess.findOrderWithToken(input.orderId, input.reservationToken);
    if (!order) throw new TicketInvalidTokenError();

    // Verify ticket belongs to this order
    const tickets = await this.ticketRepo.findByOrderId(input.orderId, order.organizationId);
    const ticket = tickets.find((t) => t.id === input.ticketId);
    if (!ticket) throw new TicketInvalidTokenError();

    // Find pending transfer
    const transfer = await this.transferRepo.findPendingByTicketId(
      input.ticketId,
      order.organizationId,
    );
    if (!transfer) throw new TransferNotFoundError();

    await this.transferRepo.cancel(transfer.id);
  }
}
