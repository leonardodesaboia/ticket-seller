import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { CancelEventUseCase } from '../../application/use-cases/cancel-event.use-case';
import { EventNotFoundError, EventNotCancellableError } from '../../domain/event-cancellation.errors';
import type { CancelEventResponse } from '../dto/cancel-event.response';

class CancelEventRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

@ApiTags('event-cancellation')
@Controller('organizations/:orgId/events/:eventId/cancellations')
@UseGuards(ActorGuard)
export class EventCancellationController {
  constructor(private readonly cancelEvent: CancelEventUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @CurrentActor() actor: ICurrentActor,
    @Body() body: CancelEventRequestDto,
  ): Promise<CancelEventResponse> {
    try {
      const result = await this.cancelEvent.execute({
        eventId,
        organizationId: orgId,
        reason: body.reason,
        actorId: actor.userId,
      });

      return {
        eventId: result.eventId,
        organizationId: result.organizationId,
        status: result.status,
        cancelledAt: result.cancelledAt.toISOString(),
        ordersCancelledCount: result.ordersCancelledCount,
      };
    } catch (err) {
      if (err instanceof EventNotFoundError) {
        throw new NotFoundException({ message: 'Event not found', code: 'EVENT_NOT_FOUND' });
      }
      if (err instanceof EventNotCancellableError) {
        throw new UnprocessableEntityException({
          message: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  }
}
