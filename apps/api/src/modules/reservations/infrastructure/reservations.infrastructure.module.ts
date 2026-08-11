import { Module } from '@nestjs/common';
import { EventAccessAdapter } from './adapters/event-access.adapter';
import { InventoryHoldAdapter } from './adapters/inventory-hold.adapter';
import { PrismaReservationRepository } from './repositories/prisma-reservation.repository';

@Module({ providers: [EventAccessAdapter, InventoryHoldAdapter, PrismaReservationRepository], exports: [PrismaReservationRepository] })
export class ReservationsInfrastructureModule {}
