import { Module } from '@nestjs/common';
import { CancelReservationUseCase } from './application/use-cases/cancel-reservation.use-case';
import { CreateReservationUseCase } from './application/use-cases/create-reservation.use-case';
import { GetReservationUseCase } from './application/use-cases/get-reservation.use-case';
import { RESERVATION_REPOSITORY, type IReservationRepository } from './domain/ports/reservation-repository.port';
import { ReservationsInfrastructureModule } from './infrastructure/reservations.infrastructure.module';
import { PrismaReservationRepository } from './infrastructure/repositories/prisma-reservation.repository';
import { PublicReservationsController } from './presentation/controllers/public-reservations.controller';

@Module({
  imports: [ReservationsInfrastructureModule],
  controllers: [PublicReservationsController],
  providers: [
    { provide: RESERVATION_REPOSITORY, useExisting: PrismaReservationRepository },
    {
      provide: CreateReservationUseCase,
      useFactory: (repo: IReservationRepository) => new CreateReservationUseCase(repo),
      inject: [RESERVATION_REPOSITORY],
    },
    {
      provide: GetReservationUseCase,
      useFactory: (repo: IReservationRepository) => new GetReservationUseCase(repo),
      inject: [RESERVATION_REPOSITORY],
    },
    {
      provide: CancelReservationUseCase,
      useFactory: (repo: IReservationRepository) => new CancelReservationUseCase(repo),
      inject: [RESERVATION_REPOSITORY],
    },
  ],
})
export class ReservationsModule {}
