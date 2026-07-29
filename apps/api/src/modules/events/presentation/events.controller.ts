import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';
import { CreateEventUseCase } from '../application/use-cases/create-event.use-case';
import { GetEventUseCase } from '../application/use-cases/get-event.use-case';
import { ListOrganizationEventsUseCase } from '../application/use-cases/list-organization-events.use-case';
import { UpdateEventUseCase } from '../application/use-cases/update-event.use-case';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVersionConflictError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../domain/event.errors';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponse } from './dto/event.response';
import { ListEventsResponse } from './dto/list-events.response';
import { UpdateEventDto } from './dto/update-event.dto';

const uuidPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('events')
@Controller('organizations/:organizationId/events')
@UseGuards(ActorGuard)
export class EventsController {
  constructor(
    private readonly createEvent: CreateEventUseCase,
    private readonly getEvent: GetEventUseCase,
    private readonly listEvents: ListOrganizationEventsUseCase,
    private readonly updateEvent: UpdateEventUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Param('organizationId', uuidPipe) organizationId: string,
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

  @Get()
  async list(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<ListEventsResponse> {
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 100) : 20;
    try {
      const result = await this.listEvents.execute({
        organizationId,
        actorId: actor.userId,
        limit,
        ...(cursor !== undefined && { cursor }),
      });
      return ListEventsResponse.from(result);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Get(':eventId')
  async findOne(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Param('eventId', uuidPipe) eventId: string,
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

  @Patch(':eventId')
  async update(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Param('eventId', uuidPipe) eventId: string,
    @Body() dto: UpdateEventDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<EventResponse> {
    try {
      const event = await this.updateEvent.execute({
        organizationId,
        eventId,
        actorId: actor.userId,
        version: dto.version,
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      });
      return EventResponse.from(event);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      if (err instanceof EventNotInDraftError) throw new UnprocessableEntityException(err.message);
      if (err instanceof EventVersionConflictError) throw new ConflictException(err.message);
      throw err;
    }
  }
}
