import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { PerformCheckInUseCase } from '../../application/use-cases/perform-check-in.use-case';
import { CheckInResponseDto, PerformCheckInBodyDto } from '../dto/check-in.dto';

@Controller('organizations/:orgId/events/:eventId/check-ins')
@UseGuards(ActorGuard)
export class CheckInController {
  constructor(private readonly performCheckIn: PerformCheckInUseCase) {}

  @Post()
  @HttpCode(200)
  async create(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Body() body: PerformCheckInBodyDto,
    @CurrentActor() actor: ICurrentActor,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CheckInResponseDto> {
    const result = await this.performCheckIn.execute({
      organizationId: orgId,
      eventId,
      credentialToken: body.credential,
      idempotencyKey: idempotencyKey ?? null,
      performedByUserId: actor.userId,
      notes: body.notes ?? null,
    });

    return {
      decision: result.decision,
      allowed: result.allowed,
      checkedInAt: result.checkedInAt,
    };
  }
}
