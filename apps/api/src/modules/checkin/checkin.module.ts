import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CheckInInfrastructureModule } from './infrastructure/checkin.infrastructure.module';
import { PerformCheckInUseCase } from './application/use-cases/perform-check-in.use-case';
import { CheckInController } from './presentation/controllers/check-in.controller';

@Module({
  imports: [HttpModule, CheckInInfrastructureModule],
  controllers: [CheckInController],
  providers: [PerformCheckInUseCase],
})
export class CheckInModule {}
