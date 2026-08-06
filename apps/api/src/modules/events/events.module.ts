import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { VenuesModule } from '../venues/venues.module';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case';
import { GetEventUseCase } from './application/use-cases/get-event.use-case';
import { ListOrganizationEventsUseCase } from './application/use-cases/list-organization-events.use-case';
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case';
import { UpdateEventConfigurationUseCase } from './application/use-cases/update-event-configuration.use-case';
import { CreateTicketTypeUseCase } from './application/use-cases/ticket-types/create-ticket-type.use-case';
import { CREATE_TICKET_TYPE_OPERATION_PORT } from './application/ports/create-ticket-type-operation.port';
import { ListEventTicketTypesUseCase } from './application/use-cases/ticket-types/list-event-ticket-types.use-case';
import { UpdateTicketTypeUseCase } from './application/use-cases/ticket-types/update-ticket-type.use-case';
import { EVENT_REPOSITORY } from './domain/ports/event-repository.port';
import { ORGANIZATION_ACCESS_PORT } from './domain/ports/organization-access.port';
import { TICKET_TYPE_REPOSITORY } from './domain/ticket-types/ticket-type-repository.port';
import { PrismaOrganizationAccessAdapter } from './infrastructure/adapters/prisma-organization-access.adapter';
import { PrismaCreateTicketTypeOperationAdapter } from './infrastructure/adapters/prisma-create-ticket-type-operation.adapter';
import { PrismaEventRepository } from './infrastructure/repositories/prisma-event.repository';
import { PrismaTicketTypeRepository } from './infrastructure/repositories/prisma-ticket-type.repository';
import { EventsController } from './presentation/events.controller';
import { TicketTypesController } from './presentation/controllers/ticket-types.controller';
import { GetPublicationReadinessUseCase } from './application/use-cases/get-publication-readiness.use-case';
import { PUBLICATION_READINESS_QUERY_PORT } from './application/ports/publication-readiness-query.port';
import { PublicationReadinessPolicy } from './domain/publication/publication-readiness.policy';
import { PrismaPublicationReadinessQueryAdapter } from './infrastructure/adapters/prisma-publication-readiness-query.adapter';
import { PublicationReadinessController } from './presentation/controllers/publication-readiness.controller';
import { PublishEventUseCase } from './application/use-cases/publish-event.use-case';
import { PUBLISH_EVENT_OPERATION_PORT } from './application/ports/publish-event-operation.port';
import { PrismaPublishEventOperationAdapter } from './infrastructure/adapters/prisma-publish-event-operation.adapter';
import { PublishEventController } from './presentation/controllers/publish-event.controller';

@Module({
  imports: [HttpModule, VenuesModule],
  controllers: [
    EventsController,
    TicketTypesController,
    PublicationReadinessController,
    PublishEventController,
  ],
  providers: [
    CreateEventUseCase,
    GetEventUseCase,
    ListOrganizationEventsUseCase,
    UpdateEventUseCase,
    UpdateEventConfigurationUseCase,
    CreateTicketTypeUseCase,
    ListEventTicketTypesUseCase,
    UpdateTicketTypeUseCase,
    GetPublicationReadinessUseCase,
    PublishEventUseCase,
    PublicationReadinessPolicy,
    { provide: EVENT_REPOSITORY, useClass: PrismaEventRepository },
    { provide: ORGANIZATION_ACCESS_PORT, useClass: PrismaOrganizationAccessAdapter },
    { provide: TICKET_TYPE_REPOSITORY, useClass: PrismaTicketTypeRepository },
    {
      provide: CREATE_TICKET_TYPE_OPERATION_PORT,
      useClass: PrismaCreateTicketTypeOperationAdapter,
    },
    {
      provide: PUBLICATION_READINESS_QUERY_PORT,
      useClass: PrismaPublicationReadinessQueryAdapter,
    },
    {
      provide: PUBLISH_EVENT_OPERATION_PORT,
      useClass: PrismaPublishEventOperationAdapter,
    },
  ],
})
export class EventsModule {}
