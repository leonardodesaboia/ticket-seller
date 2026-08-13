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

@Module({
  imports: [TicketsInfrastructureModule],
  controllers: [
    PublicTicketsController,
    PublicTicketCredentialController,
    TicketTransferController,
    PublicTransferAcceptController,
  ],
  providers: [
    IssueTicketsUseCase,
    GetOrderTicketsUseCase,
    IssueTicketCredentialUseCase,
    GetTicketCredentialUseCase,
    InitiateTransferUseCase,
    CancelTransferUseCase,
    AcceptTransferUseCase,
  ],
  exports: [IssueTicketsUseCase, TicketsInfrastructureModule],
})
export class TicketsModule {}
