import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { VenuesModule } from '../venues/venues.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case';
import { GetEventUseCase } from './application/use-cases/get-event.use-case';
import { ListOrganizationEventsUseCase } from './application/use-cases/list-organization-events.use-case';
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case';
import { UpdateEventConfigurationUseCase } from './application/use-cases/update-event-configuration.use-case';
import { CreateTicketTypeUseCase } from './application/use-cases/ticket-types/create-ticket-type.use-case';
import {
  CREATE_TICKET_TYPE_OPERATION_PORT,
  type ICreateTicketTypeOperationPort,
} from './application/ports/create-ticket-type-operation.port';
import { ListEventTicketTypesUseCase } from './application/use-cases/ticket-types/list-event-ticket-types.use-case';
import { UpdateTicketTypeUseCase } from './application/use-cases/ticket-types/update-ticket-type.use-case';
import { EVENT_REPOSITORY, type IEventRepository } from './domain/ports/event-repository.port';
import {
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from './domain/ports/organization-access.port';
import {
  TICKET_TYPE_REPOSITORY,
  type ITicketTypeRepository,
} from './domain/ticket-types/ticket-type-repository.port';
import { PrismaCreateTicketTypeOperationAdapter } from './infrastructure/adapters/prisma-create-ticket-type-operation.adapter';
import { PrismaEventRepository } from './infrastructure/repositories/prisma-event.repository';
import { PrismaTicketTypeRepository } from './infrastructure/repositories/prisma-ticket-type.repository';
import { PrismaEventCancellationRepository } from './infrastructure/repositories/prisma-event-cancellation.repository';
import { EventsController } from './presentation/events.controller';
import { TicketTypesController } from './presentation/controllers/ticket-types.controller';
import { GetPublicationReadinessUseCase } from './application/use-cases/get-publication-readiness.use-case';
import {
  PUBLICATION_READINESS_QUERY_PORT,
  type IPublicationReadinessQueryPort,
} from './application/ports/publication-readiness-query.port';
import { PublicationReadinessPolicy } from './domain/publication/publication-readiness.policy';
import { PrismaPublicationReadinessQueryAdapter } from './infrastructure/adapters/prisma-publication-readiness-query.adapter';
import { PublicationReadinessController } from './presentation/controllers/publication-readiness.controller';
import { PublishEventUseCase } from './application/use-cases/publish-event.use-case';
import {
  PUBLISH_EVENT_OPERATION_PORT,
  type IPublishEventOperationPort,
} from './application/ports/publish-event-operation.port';
import { PrismaPublishEventOperationAdapter } from './infrastructure/adapters/prisma-publish-event-operation.adapter';
import { PublishEventController } from './presentation/controllers/publish-event.controller';
import { ListPublicEventsUseCase } from './application/use-cases/list-public-events.use-case';
import { GetPublicEventUseCase } from './application/use-cases/get-public-event.use-case';
import {
  PUBLIC_EVENT_QUERY_PORT,
  type IPublicEventQueryPort,
} from './application/ports/public-event-query.port';
import { PrismaPublicEventQueryAdapter } from './infrastructure/adapters/prisma-public-event-query.adapter';
import { PublicEventsController } from './presentation/controllers/public-events.controller';
import { CancelEventUseCase } from './application/use-cases/cancel-event.use-case';
import {
  EVENT_CANCELLATION_REPOSITORY,
  type IEventCancellationRepository,
} from './application/ports/event-cancellation-repository.port';
import { EventCancellationController } from './presentation/controllers/event-cancellation.controller';
import {
  VENUE_ACCESS_PORT,
  type IVenueAccessPort,
} from '../venues/contracts/venue-access.contract';

@Module({
  imports: [HttpModule, VenuesModule, OrganizationsModule],
  controllers: [
    EventsController,
    TicketTypesController,
    PublicationReadinessController,
    PublishEventController,
    PublicEventsController,
    EventCancellationController,
  ],
  providers: [
    PublicationReadinessPolicy,
    PrismaEventCancellationRepository,
    { provide: EVENT_REPOSITORY, useClass: PrismaEventRepository },
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
    {
      provide: PUBLIC_EVENT_QUERY_PORT,
      useClass: PrismaPublicEventQueryAdapter,
    },
    {
      provide: EVENT_CANCELLATION_REPOSITORY,
      useExisting: PrismaEventCancellationRepository,
    },
    {
      provide: CreateEventUseCase,
      useFactory: (repo: IEventRepository, orgAccess: IOrganizationAccessPort) =>
        new CreateEventUseCase(repo, orgAccess),
      inject: [EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: GetEventUseCase,
      useFactory: (repo: IEventRepository, orgAccess: IOrganizationAccessPort) =>
        new GetEventUseCase(repo, orgAccess),
      inject: [EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: ListOrganizationEventsUseCase,
      useFactory: (repo: IEventRepository, orgAccess: IOrganizationAccessPort) =>
        new ListOrganizationEventsUseCase(repo, orgAccess),
      inject: [EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: UpdateEventUseCase,
      useFactory: (repo: IEventRepository, orgAccess: IOrganizationAccessPort) =>
        new UpdateEventUseCase(repo, orgAccess),
      inject: [EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: UpdateEventConfigurationUseCase,
      useFactory: (
        repo: IEventRepository,
        orgAccess: IOrganizationAccessPort,
        venueAccess: IVenueAccessPort,
      ) => new UpdateEventConfigurationUseCase(repo, orgAccess, venueAccess),
      inject: [EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT, VENUE_ACCESS_PORT],
    },
    {
      provide: GetPublicationReadinessUseCase,
      useFactory: (
        query: IPublicationReadinessQueryPort,
        orgAccess: IOrganizationAccessPort,
        policy: PublicationReadinessPolicy,
      ) => new GetPublicationReadinessUseCase(query, orgAccess, policy),
      inject: [PUBLICATION_READINESS_QUERY_PORT, ORGANIZATION_ACCESS_PORT, PublicationReadinessPolicy],
    },
    {
      provide: PublishEventUseCase,
      useFactory: (
        publishOperation: IPublishEventOperationPort,
        orgAccess: IOrganizationAccessPort,
      ) => new PublishEventUseCase(publishOperation, orgAccess),
      inject: [PUBLISH_EVENT_OPERATION_PORT, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: CancelEventUseCase,
      useFactory: (
        repo: IEventCancellationRepository,
        orgAccess: IOrganizationAccessPort,
      ) => new CancelEventUseCase(repo, orgAccess),
      inject: [EVENT_CANCELLATION_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: ListPublicEventsUseCase,
      useFactory: (queryPort: IPublicEventQueryPort) => new ListPublicEventsUseCase(queryPort),
      inject: [PUBLIC_EVENT_QUERY_PORT],
    },
    {
      provide: GetPublicEventUseCase,
      useFactory: (queryPort: IPublicEventQueryPort) => new GetPublicEventUseCase(queryPort),
      inject: [PUBLIC_EVENT_QUERY_PORT],
    },
    {
      provide: CreateTicketTypeUseCase,
      useFactory: (
        createOperation: ICreateTicketTypeOperationPort,
        repo: IEventRepository,
        orgAccess: IOrganizationAccessPort,
      ) => new CreateTicketTypeUseCase(createOperation, repo, orgAccess),
      inject: [CREATE_TICKET_TYPE_OPERATION_PORT, EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: ListEventTicketTypesUseCase,
      useFactory: (
        ticketTypeRepo: ITicketTypeRepository,
        eventRepo: IEventRepository,
        orgAccess: IOrganizationAccessPort,
      ) => new ListEventTicketTypesUseCase(ticketTypeRepo, eventRepo, orgAccess),
      inject: [TICKET_TYPE_REPOSITORY, EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: UpdateTicketTypeUseCase,
      useFactory: (
        ticketTypeRepo: ITicketTypeRepository,
        eventRepo: IEventRepository,
        orgAccess: IOrganizationAccessPort,
      ) => new UpdateTicketTypeUseCase(ticketTypeRepo, eventRepo, orgAccess),
      inject: [TICKET_TYPE_REPOSITORY, EVENT_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
  ],
  exports: [PUBLIC_EVENT_QUERY_PORT],
})
export class EventsModule {}
