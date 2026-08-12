import { Module } from '@nestjs/common';
import { TicketsInfrastructureModule } from './infrastructure/tickets.infrastructure.module';
import { IssueTicketsUseCase } from './application/use-cases/issue-tickets.use-case';
import { GetOrderTicketsUseCase } from './application/use-cases/get-order-tickets.use-case';
import { PublicTicketsController } from './presentation/controllers/public-tickets.controller';
import { TICKET_REPOSITORY } from './domain/ports/ticket-repository.port';
import { ORDER_ITEMS_ACCESS_PORT } from './application/ports/order-items-access.port';
import { TICKET_ORDER_ACCESS_PORT } from './application/ports/ticket-order-access.port';

@Module({
  imports: [TicketsInfrastructureModule],
  controllers: [PublicTicketsController],
  providers: [IssueTicketsUseCase, GetOrderTicketsUseCase],
  exports: [IssueTicketsUseCase, TICKET_REPOSITORY, ORDER_ITEMS_ACCESS_PORT, TICKET_ORDER_ACCESS_PORT],
})
export class TicketsModule {}
