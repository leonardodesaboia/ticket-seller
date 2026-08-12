import { Module } from '@nestjs/common';
import { TicketsInfrastructureModule } from './infrastructure/tickets.infrastructure.module';
import { IssueTicketsUseCase } from './application/use-cases/issue-tickets.use-case';
import { GetOrderTicketsUseCase } from './application/use-cases/get-order-tickets.use-case';
import { IssueTicketCredentialUseCase } from './application/use-cases/issue-ticket-credential.use-case';
import { GetTicketCredentialUseCase } from './application/use-cases/get-ticket-credential.use-case';
import { PublicTicketsController } from './presentation/controllers/public-tickets.controller';
import { PublicTicketCredentialController } from './presentation/controllers/public-ticket-credential.controller';

@Module({
  imports: [TicketsInfrastructureModule],
  controllers: [PublicTicketsController, PublicTicketCredentialController],
  providers: [
    IssueTicketsUseCase,
    GetOrderTicketsUseCase,
    IssueTicketCredentialUseCase,
    GetTicketCredentialUseCase,
  ],
  exports: [IssueTicketsUseCase, TicketsInfrastructureModule],
})
export class TicketsModule {}
