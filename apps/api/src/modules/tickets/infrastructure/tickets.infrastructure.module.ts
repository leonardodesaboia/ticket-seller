import { Module } from '@nestjs/common';
import { TICKET_REPOSITORY } from '../domain/ports/ticket-repository.port';
import { ORDER_ITEMS_ACCESS_PORT } from '../application/ports/order-items-access.port';
import { TICKET_ORDER_ACCESS_PORT } from '../application/ports/ticket-order-access.port';
import { PrismaTicketRepository } from './repositories/prisma-ticket.repository';
import { OrderItemsAccessAdapter } from './adapters/order-items-access.adapter';
import { TicketOrderAccessAdapter } from './adapters/ticket-order-access.adapter';

@Module({
  providers: [
    PrismaTicketRepository,
    OrderItemsAccessAdapter,
    TicketOrderAccessAdapter,
    { provide: TICKET_REPOSITORY, useExisting: PrismaTicketRepository },
    { provide: ORDER_ITEMS_ACCESS_PORT, useExisting: OrderItemsAccessAdapter },
    { provide: TICKET_ORDER_ACCESS_PORT, useExisting: TicketOrderAccessAdapter },
  ],
  exports: [TICKET_REPOSITORY, ORDER_ITEMS_ACCESS_PORT, TICKET_ORDER_ACCESS_PORT],
})
export class TicketsInfrastructureModule {}
