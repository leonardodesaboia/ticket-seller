import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CheckInInfrastructureModule } from './infrastructure/checkin.infrastructure.module';
import { PerformCheckInUseCase } from './application/use-cases/perform-check-in.use-case';
import { GetEventAttendanceUseCase } from './application/use-cases/get-event-attendance.use-case';
import { CheckInController } from './presentation/controllers/check-in.controller';
import { EventAttendanceController } from './presentation/controllers/event-attendance.controller';
import { CHECK_IN_REPOSITORY, ICheckInRepository } from './domain/ports/check-in-repository.port';
import { EVENT_ACCESS_FOR_CHECKIN_PORT, IEventAccessForCheckInPort } from './application/ports/event-access.port';
import { TICKET_ACCESS_FOR_CHECKIN_PORT, ITicketAccessForCheckInPort } from './application/ports/ticket-access.port';

@Module({
  imports: [HttpModule, CheckInInfrastructureModule],
  controllers: [CheckInController, EventAttendanceController],
  providers: [
    {
      provide: PerformCheckInUseCase,
      useFactory: (repo: ICheckInRepository, eventAccess: IEventAccessForCheckInPort, ticketAccess: ITicketAccessForCheckInPort) =>
        new PerformCheckInUseCase(repo, eventAccess, ticketAccess),
      inject: [CHECK_IN_REPOSITORY, EVENT_ACCESS_FOR_CHECKIN_PORT, TICKET_ACCESS_FOR_CHECKIN_PORT],
    },
    {
      provide: GetEventAttendanceUseCase,
      useFactory: (repo: ICheckInRepository) => new GetEventAttendanceUseCase(repo),
      inject: [CHECK_IN_REPOSITORY],
    },
  ],
})
export class CheckInModule {}
