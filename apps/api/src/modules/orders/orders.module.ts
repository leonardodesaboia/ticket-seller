import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { ORGANIZATION_INVITATION_REPOSITORY } from '../organizations/domain/ports/organization-invitation-repository.port';
import { PrismaOrganizationInvitationRepository } from '../organizations/infrastructure/repositories/prisma-organization-invitation.repository';
import { RESERVATION_ACCESS } from './application/ports/reservation-access.port';
import { ORDER_CANCELLATION_REPOSITORY } from './application/ports/order-cancellation-repository.port';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case';
import { ORDER_REPOSITORY } from './domain/ports/order-repository.port';
import { OrdersInfrastructureModule } from './infrastructure/orders.infrastructure.module';
import { PrismaReservationAccessAdapter } from './infrastructure/adapters/reservation-access.adapter';
import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';
import { PrismaOrderCancellationRepository } from './infrastructure/repositories/prisma-order-cancellation.repository';
import { PublicOrdersController } from './presentation/controllers/public-orders.controller';
import { OrderCancellationController } from './presentation/controllers/order-cancellation.controller';

@Module({
  imports: [HttpModule, OrdersInfrastructureModule],
  controllers: [PublicOrdersController, OrderCancellationController],
  providers: [
    OrganizationRoleGuard,
    { provide: ORGANIZATION_INVITATION_REPOSITORY, useClass: PrismaOrganizationInvitationRepository },
    CreateOrderUseCase,
    GetOrderUseCase,
    CancelOrderUseCase,
    { provide: RESERVATION_ACCESS, useExisting: PrismaReservationAccessAdapter },
    { provide: ORDER_REPOSITORY, useExisting: PrismaOrderRepository },
    { provide: ORDER_CANCELLATION_REPOSITORY, useExisting: PrismaOrderCancellationRepository },
  ],
})
export class OrdersModule {}
