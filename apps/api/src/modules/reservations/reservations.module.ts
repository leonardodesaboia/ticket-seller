import { Module } from '@nestjs/common';
import { CancelReservationUseCase } from './application/use-cases/cancel-reservation.use-case';
import { CreateReservationUseCase } from './application/use-cases/create-reservation.use-case';
import { GetReservationUseCase } from './application/use-cases/get-reservation.use-case';
import { RESERVATION_REPOSITORY } from './domain/ports/reservation-repository.port';
import { ReservationsInfrastructureModule } from './infrastructure/reservations.infrastructure.module';
import { PrismaReservationRepository } from './infrastructure/repositories/prisma-reservation.repository';
import { PublicReservationsController } from './presentation/controllers/public-reservations.controller';

@Module({
  imports: [ReservationsInfrastructureModule],
  controllers: [PublicReservationsController],
  providers: [
    CreateReservationUseCase,
    GetReservationUseCase,
    CancelReservationUseCase,
    { provide: RESERVATION_REPOSITORY, useExisting: PrismaReservationRepository },
  ],
})
export class ReservationsModule {}
