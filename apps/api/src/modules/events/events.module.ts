import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { VenuesModule } from '../venues/venues.module';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case';
import { GetEventUseCase } from './application/use-cases/get-event.use-case';
import { ListOrganizationEventsUseCase } from './application/use-cases/list-organization-events.use-case';
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case';
import { UpdateEventConfigurationUseCase } from './application/use-cases/update-event-configuration.use-case';
import { EVENT_REPOSITORY } from './domain/ports/event-repository.port';
import { ORGANIZATION_ACCESS_PORT } from './domain/ports/organization-access.port';
import { PrismaOrganizationAccessAdapter } from './infrastructure/adapters/prisma-organization-access.adapter';
import { PrismaEventRepository } from './infrastructure/repositories/prisma-event.repository';
import { EventsController } from './presentation/events.controller';

@Module({
  imports: [HttpModule, VenuesModule],
  controllers: [EventsController],
  providers: [
    CreateEventUseCase,
    GetEventUseCase,
    ListOrganizationEventsUseCase,
    UpdateEventUseCase,
    UpdateEventConfigurationUseCase,
    { provide: EVENT_REPOSITORY, useClass: PrismaEventRepository },
    { provide: ORGANIZATION_ACCESS_PORT, useClass: PrismaOrganizationAccessAdapter },
  ],
})
export class EventsModule {}
