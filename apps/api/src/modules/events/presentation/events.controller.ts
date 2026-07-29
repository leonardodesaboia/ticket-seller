import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';
import { CreateEventUseCase } from '../application/use-cases/create-event.use-case';
import { GetEventUseCase } from '../application/use-cases/get-event.use-case';
import {
  EventNotFoundError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../domain/event.errors';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponse } from './dto/event.response';

@ApiTags('events')
@Controller('organizations/:organizationId/events')
@UseGuards(ActorGuard)
export class EventsController {
  constructor(
    private readonly createEvent: CreateEventUseCase,
    private readonly getEvent: GetEventUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateEventDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<EventResponse> {
    try {
      const event = await this.createEvent.execute({
        organizationId,
        title: dto.title,
        description: dto.description ?? null,
        actorId: actor.userId,
      });
      return EventResponse.from(event);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      throw err;
    }
  }

  @Get(':eventId')
  async findOne(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<EventResponse> {
    try {
      const event = await this.getEvent.execute({ organizationId, eventId, actorId: actor.userId });
      return EventResponse.from(event);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }
}
