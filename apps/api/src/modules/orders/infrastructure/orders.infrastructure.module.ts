import { Module } from '@nestjs/common';
import { PrismaReservationAccessAdapter } from './adapters/reservation-access.adapter';
import { PrismaOrderRepository } from './repositories/prisma-order.repository';
import { PrismaOrderCancellationRepository } from './repositories/prisma-order-cancellation.repository';

@Module({
  providers: [PrismaReservationAccessAdapter, PrismaOrderRepository, PrismaOrderCancellationRepository],
  exports: [PrismaReservationAccessAdapter, PrismaOrderRepository, PrismaOrderCancellationRepository],
})
export class OrdersInfrastructureModule {}
