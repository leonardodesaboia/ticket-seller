import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { GetAvailabilityUseCase } from './application/use-cases/get-availability.use-case';
import { INVENTORY_REPOSITORY } from './domain/ports/inventory-repository.port';
import { PrismaInventoryRepository } from './infrastructure/repositories/prisma-inventory.repository';
import { PublicAvailabilityController } from './presentation/controllers/public-availability.controller';

@Module({
  imports: [EventsModule],
  controllers: [PublicAvailabilityController],
  providers: [
    GetAvailabilityUseCase,
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
  ],
})
export class InventoryModule {}
