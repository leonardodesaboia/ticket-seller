import { Module } from '@nestjs/common';
import { RESERVATION_ACCESS } from './application/ports/reservation-access.port';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { ORDER_REPOSITORY } from './domain/ports/order-repository.port';
import { OrdersInfrastructureModule } from './infrastructure/orders.infrastructure.module';
import { PrismaReservationAccessAdapter } from './infrastructure/adapters/reservation-access.adapter';
import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';
import { PublicOrdersController } from './presentation/controllers/public-orders.controller';

@Module({
  imports: [OrdersInfrastructureModule],
  controllers: [PublicOrdersController],
  providers: [
    CreateOrderUseCase,
    GetOrderUseCase,
    { provide: RESERVATION_ACCESS, useExisting: PrismaReservationAccessAdapter },
    { provide: ORDER_REPOSITORY, useExisting: PrismaOrderRepository },
  ],
})
export class OrdersModule {}
