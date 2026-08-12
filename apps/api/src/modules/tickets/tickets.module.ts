import { Module } from '@nestjs/common';
import { TicketsInfrastructureModule } from './infrastructure/tickets.infrastructure.module';
import { IssueTicketsUseCase } from './application/use-cases/issue-tickets.use-case';
import { GetOrderTicketsUseCase } from './application/use-cases/get-order-tickets.use-case';
import { PublicTicketsController } from './presentation/controllers/public-tickets.controller';

@Module({
  imports: [TicketsInfrastructureModule],
  controllers: [PublicTicketsController],
  providers: [IssueTicketsUseCase, GetOrderTicketsUseCase],
  exports: [IssueTicketsUseCase, TicketsInfrastructureModule],
})
export class TicketsModule {}
