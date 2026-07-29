import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case';
import { GetEventUseCase } from './application/use-cases/get-event.use-case';
import { EVENT_REPOSITORY } from './domain/ports/event-repository.port';
import { ORGANIZATION_ACCESS_PORT } from './domain/ports/organization-access.port';
import { PrismaOrganizationAccessAdapter } from './infrastructure/adapters/prisma-organization-access.adapter';
import { PrismaEventRepository } from './infrastructure/repositories/prisma-event.repository';
import { EventsController } from './presentation/events.controller';

@Module({
  imports: [HttpModule],
  controllers: [EventsController],
  providers: [
    CreateEventUseCase,
    GetEventUseCase,
    { provide: EVENT_REPOSITORY, useClass: PrismaEventRepository },
    { provide: ORGANIZATION_ACCESS_PORT, useClass: PrismaOrganizationAccessAdapter },
  ],
})
export class EventsModule {}
