import * as crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  TICKET_TRANSFER_REPOSITORY,
  ITicketTransferRepository,
} from '../../domain/ports/ticket-transfer-repository.port';
import {
  TICKET_ORDER_ACCESS_PORT,
  ITicketOrderAccessPort,
} from '../ports/ticket-order-access.port';
import {
  TICKET_REPOSITORY,
  ITicketRepository,
} from '../../domain/ports/ticket-repository.port';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { TicketAlreadyAdmittedError, TransferAlreadyPendingError } from '../../domain/ticket-transfer.errors';

export interface InitiateTransferInput {
  orderId: string;
  ticketId: string;
  reservationToken: string;
}

export interface InitiateTransferResult {
  claimToken: string;
  expiresAt: Date;
}

@Injectable()
export class InitiateTransferUseCase {
  constructor(
    @Inject(TICKET_TRANSFER_REPOSITORY)
    private readonly transferRepo: ITicketTransferRepository,
    @Inject(TICKET_ORDER_ACCESS_PORT)
    private readonly orderAccess: ITicketOrderAccessPort,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: InitiateTransferInput): Promise<InitiateTransferResult> {
    // Validate order ownership via reservation token
    const order = await this.orderAccess.findOrderWithToken(input.orderId, input.reservationToken);
    if (!order) throw new TicketInvalidTokenError();

    // Verify ticket belongs to this order
    const tickets = await this.ticketRepo.findByOrderId(input.orderId, order.organizationId);
    const ticket = tickets.find((t) => t.id === input.ticketId);
    if (!ticket) throw new TicketInvalidTokenError();

    // Check if ticket has been admitted
    const admittedRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM check_ins
      WHERE ticket_id = ${input.ticketId}::uuid
        AND result = 'ADMITTED'
      LIMIT 1
    `;
    if (admittedRows.length > 0) {
      throw new TicketAlreadyAdmittedError(input.ticketId);
    }

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
