import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CheckInInfrastructureModule } from './infrastructure/checkin.infrastructure.module';
import { PerformCheckInUseCase } from './application/use-cases/perform-check-in.use-case';
import { GetEventAttendanceUseCase } from './application/use-cases/get-event-attendance.use-case';
import { CheckInController } from './presentation/controllers/check-in.controller';
import { EventAttendanceController } from './presentation/controllers/event-attendance.controller';

@Module({
  imports: [HttpModule, CheckInInfrastructureModule],
  controllers: [CheckInController, EventAttendanceController],
  providers: [PerformCheckInUseCase, GetEventAttendanceUseCase],
})
export class CheckInModule {}
