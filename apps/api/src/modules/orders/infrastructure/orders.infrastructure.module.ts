import { Module } from '@nestjs/common';
import { PrismaReservationAccessAdapter } from './adapters/reservation-access.adapter';
import { PrismaOrderRepository } from './repositories/prisma-order.repository';

@Module({ providers: [PrismaReservationAccessAdapter, PrismaOrderRepository], exports: [PrismaReservationAccessAdapter, PrismaOrderRepository] })
export class OrdersInfrastructureModule {}
