import { Module } from '@nestjs/common';
import { TicketsInfrastructureModule } from './infrastructure/tickets.infrastructure.module';
import { IssueTicketsUseCase } from './application/use-cases/issue-tickets.use-case';
import { GetOrderTicketsUseCase } from './application/use-cases/get-order-tickets.use-case';
import { IssueTicketCredentialUseCase } from './application/use-cases/issue-ticket-credential.use-case';
import { GetTicketCredentialUseCase } from './application/use-cases/get-ticket-credential.use-case';
import { InitiateTransferUseCase } from './application/use-cases/initiate-transfer.use-case';
import { CancelTransferUseCase } from './application/use-cases/cancel-transfer.use-case';
import { AcceptTransferUseCase } from './application/use-cases/accept-transfer.use-case';
import { PublicTicketsController } from './presentation/controllers/public-tickets.controller';
import { PublicTicketCredentialController } from './presentation/controllers/public-ticket-credential.controller';
import { TicketTransferController } from './presentation/controllers/ticket-transfer.controller';
import { PublicTransferAcceptController } from './presentation/controllers/public-transfer-accept.controller';
import { TICKET_REPOSITORY, ITicketRepository } from './domain/ports/ticket-repository.port';
import { TICKET_CREDENTIAL_REPOSITORY, ITicketCredentialRepository } from './domain/ports/ticket-credential-repository.port';
import { TICKET_TRANSFER_REPOSITORY, ITicketTransferRepository } from './domain/ports/ticket-transfer-repository.port';
import { ORDER_ITEMS_ACCESS_PORT, IOrderItemsAccessPort } from './application/ports/order-items-access.port';
import { TICKET_ORDER_ACCESS_PORT, ITicketOrderAccessPort } from './application/ports/ticket-order-access.port';
import { CHECK_IN_ACCESS_FOR_TRANSFER_PORT, ICheckInAccessForTransferPort } from './application/ports/check-in-access-for-transfer.port';

@Module({
  imports: [TicketsInfrastructureModule],
  controllers: [
    PublicTicketsController,
    PublicTicketCredentialController,
    TicketTransferController,
    PublicTransferAcceptController,
  ],
  providers: [
    {
      provide: IssueTicketsUseCase,
      useFactory: (ticketRepo: ITicketRepository, orderItemsAccess: IOrderItemsAccessPort) =>
        new IssueTicketsUseCase(ticketRepo, orderItemsAccess),
      inject: [TICKET_REPOSITORY, ORDER_ITEMS_ACCESS_PORT],
    },
    {
      provide: GetOrderTicketsUseCase,
      useFactory: (ticketRepo: ITicketRepository, orderAccess: ITicketOrderAccessPort) =>
        new GetOrderTicketsUseCase(ticketRepo, orderAccess),
      inject: [TICKET_REPOSITORY, TICKET_ORDER_ACCESS_PORT],
    },
    {
      provide: IssueTicketCredentialUseCase,
      useFactory: (
        credentialRepo: ITicketCredentialRepository,
        orderAccess: ITicketOrderAccessPort,
        ticketRepo: ITicketRepository,
      ) => new IssueTicketCredentialUseCase(credentialRepo, orderAccess, ticketRepo),
      inject: [TICKET_CREDENTIAL_REPOSITORY, TICKET_ORDER_ACCESS_PORT, TICKET_REPOSITORY],
    },
    {
      provide: GetTicketCredentialUseCase,
      useFactory: (
        credentialRepo: ITicketCredentialRepository,
        orderAccess: ITicketOrderAccessPort,
        ticketRepo: ITicketRepository,
      ) => new GetTicketCredentialUseCase(credentialRepo, orderAccess, ticketRepo),
      inject: [TICKET_CREDENTIAL_REPOSITORY, TICKET_ORDER_ACCESS_PORT, TICKET_REPOSITORY],
    },
    {
      provide: InitiateTransferUseCase,
      useFactory: (
        transferRepo: ITicketTransferRepository,
        orderAccess: ITicketOrderAccessPort,
        ticketRepo: ITicketRepository,
        checkInAccess: ICheckInAccessForTransferPort,
      ) => new InitiateTransferUseCase(transferRepo, orderAccess, ticketRepo, checkInAccess),
      inject: [TICKET_TRANSFER_REPOSITORY, TICKET_ORDER_ACCESS_PORT, TICKET_REPOSITORY, CHECK_IN_ACCESS_FOR_TRANSFER_PORT],
    },
    {
      provide: CancelTransferUseCase,
      useFactory: (
        transferRepo: ITicketTransferRepository,
        orderAccess: ITicketOrderAccessPort,
        ticketRepo: ITicketRepository,
      ) => new CancelTransferUseCase(transferRepo, orderAccess, ticketRepo),
      inject: [TICKET_TRANSFER_REPOSITORY, TICKET_ORDER_ACCESS_PORT, TICKET_REPOSITORY],
    },
    {
      provide: AcceptTransferUseCase,
      useFactory: (transferRepo: ITicketTransferRepository) =>
        new AcceptTransferUseCase(transferRepo),
      inject: [TICKET_TRANSFER_REPOSITORY],
    },
  ],
  exports: [IssueTicketsUseCase, TicketsInfrastructureModule],
})
export class TicketsModule {}
