import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RESERVATION_ACCESS, type IReservationAccess } from './application/ports/reservation-access.port';
import { ORDER_CANCELLATION_REPOSITORY, type IOrderCancellationRepository } from './application/ports/order-cancellation-repository.port';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case';
import { ORDER_REPOSITORY, type IOrderRepository } from './domain/ports/order-repository.port';
import { OrdersInfrastructureModule } from './infrastructure/orders.infrastructure.module';
import { PrismaReservationAccessAdapter } from './infrastructure/adapters/reservation-access.adapter';
import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';
import { PrismaOrderCancellationRepository } from './infrastructure/repositories/prisma-order-cancellation.repository';
import { PublicOrdersController } from './presentation/controllers/public-orders.controller';
import { OrderCancellationController } from './presentation/controllers/order-cancellation.controller';

@Module({
  imports: [HttpModule, OrdersInfrastructureModule, OrganizationsModule],
  controllers: [PublicOrdersController, OrderCancellationController],
  providers: [
    OrganizationRoleGuard,
    { provide: RESERVATION_ACCESS, useExisting: PrismaReservationAccessAdapter },
    { provide: ORDER_REPOSITORY, useExisting: PrismaOrderRepository },
    { provide: ORDER_CANCELLATION_REPOSITORY, useExisting: PrismaOrderCancellationRepository },
    {
      provide: CreateOrderUseCase,
      useFactory: (reservationAccess: IReservationAccess) => new CreateOrderUseCase(reservationAccess),
      inject: [RESERVATION_ACCESS],
    },
    {
      provide: GetOrderUseCase,
      useFactory: (repo: IOrderRepository) => new GetOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: CancelOrderUseCase,
      useFactory: (repo: IOrderCancellationRepository) => new CancelOrderUseCase(repo),
      inject: [ORDER_CANCELLATION_REPOSITORY],
    },
  ],
})
export class OrdersModule {}
