import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { InitializeEventInventoryUseCase } from './application/use-cases/initialize-event-inventory.use-case';
import { GetAvailabilityUseCase } from './application/use-cases/get-availability.use-case';
import { INVENTORY_INITIALIZATION_PORT } from './application/ports/inventory-initialization.port';
import { INVENTORY_REPOSITORY } from './domain/ports/inventory-repository.port';
import { PrismaInventoryRepository } from './infrastructure/repositories/prisma-inventory.repository';
import { PublicAvailabilityController } from './presentation/controllers/public-availability.controller';

@Module({
  imports: [EventsModule],
  controllers: [PublicAvailabilityController],
  providers: [
    InitializeEventInventoryUseCase,
    GetAvailabilityUseCase,
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    {
      provide: INVENTORY_INITIALIZATION_PORT,
      useClass: PrismaInventoryRepository,
    },
  ],
  exports: [INVENTORY_INITIALIZATION_PORT],
})
export class InventoryModule {}
