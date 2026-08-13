import { Module } from '@nestjs/common';
import { TICKET_REPOSITORY } from '../domain/ports/ticket-repository.port';
import { TICKET_CREDENTIAL_REPOSITORY } from '../domain/ports/ticket-credential-repository.port';
import { TICKET_TRANSFER_REPOSITORY } from '../domain/ports/ticket-transfer-repository.port';
import { ORDER_ITEMS_ACCESS_PORT } from '../application/ports/order-items-access.port';
import { TICKET_ORDER_ACCESS_PORT } from '../application/ports/ticket-order-access.port';
import { CHECK_IN_ACCESS_FOR_TRANSFER_PORT } from '../application/ports/check-in-access-for-transfer.port';
import { PrismaTicketRepository } from './repositories/prisma-ticket.repository';
import { PrismaTicketCredentialRepository } from './repositories/prisma-ticket-credential.repository';
import { PrismaTicketTransferRepository } from './repositories/prisma-ticket-transfer.repository';
import { OrderItemsAccessAdapter } from './adapters/order-items-access.adapter';
import { TicketOrderAccessAdapter } from './adapters/ticket-order-access.adapter';
import { CheckInAccessForTransferAdapter } from './adapters/check-in-access-for-transfer.adapter';

@Module({
  providers: [
    PrismaTicketRepository,
    PrismaTicketCredentialRepository,
    PrismaTicketTransferRepository,
    OrderItemsAccessAdapter,
    TicketOrderAccessAdapter,
    CheckInAccessForTransferAdapter,
    { provide: TICKET_REPOSITORY, useExisting: PrismaTicketRepository },
    { provide: TICKET_CREDENTIAL_REPOSITORY, useExisting: PrismaTicketCredentialRepository },
    { provide: TICKET_TRANSFER_REPOSITORY, useExisting: PrismaTicketTransferRepository },
    { provide: ORDER_ITEMS_ACCESS_PORT, useExisting: OrderItemsAccessAdapter },
    { provide: TICKET_ORDER_ACCESS_PORT, useExisting: TicketOrderAccessAdapter },
    { provide: CHECK_IN_ACCESS_FOR_TRANSFER_PORT, useExisting: CheckInAccessForTransferAdapter },
  ],
  exports: [
    TICKET_REPOSITORY,
    TICKET_CREDENTIAL_REPOSITORY,
    TICKET_TRANSFER_REPOSITORY,
    ORDER_ITEMS_ACCESS_PORT,
    TICKET_ORDER_ACCESS_PORT,
    CHECK_IN_ACCESS_FOR_TRANSFER_PORT,
  ],
})
export class TicketsInfrastructureModule {}
