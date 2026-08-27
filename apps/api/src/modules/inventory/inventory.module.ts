import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { GetAvailabilityUseCase } from './application/use-cases/get-availability.use-case';
import { INVENTORY_REPOSITORY, IInventoryRepository } from './domain/ports/inventory-repository.port';
import { PUBLIC_EVENT_QUERY_PORT, IPublicEventQueryPort } from '../events/contracts/public-event-query.contract';
import { PrismaInventoryRepository } from './infrastructure/repositories/prisma-inventory.repository';
import { PublicAvailabilityController } from './presentation/controllers/public-availability.controller';

@Module({
  imports: [EventsModule],
  controllers: [PublicAvailabilityController],
  providers: [
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    {
      provide: GetAvailabilityUseCase,
      useFactory: (repo: IInventoryRepository, eventQuery: IPublicEventQueryPort) =>
        new GetAvailabilityUseCase(repo, eventQuery),
      inject: [INVENTORY_REPOSITORY, PUBLIC_EVENT_QUERY_PORT],
    },
  ],
})
export class InventoryModule {}
