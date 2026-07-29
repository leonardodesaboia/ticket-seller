import {
  BadRequestException,
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
import { UpdateEventConfigurationUseCase } from '../application/use-cases/update-event-configuration.use-case';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVersionConflictError,
  EventVenueNotFoundError,
  EventVenueOrganizationMismatchError,
  InsufficientRoleError,
  InvalidDateRangeError,
  InvalidOnlineConfigurationUpdateError,
  InvalidTimezoneError,
  OrganizationAccessDeniedError,
} from '../domain/event.errors';
import { EventCurrencyLockedError } from '../domain/ticket-types/ticket-type.errors';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponse } from './dto/event.response';
import { ListEventsResponse } from './dto/list-events.response';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventConfigurationDto } from './dto/update-event-configuration.dto';

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
    private readonly updateConfiguration: UpdateEventConfigurationUseCase,
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

  @Patch(':eventId/configuration')
  async configure(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Param('eventId', uuidPipe) eventId: string,
    @Body() dto: UpdateEventConfigurationDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<EventResponse> {
    try {
      const event = await this.updateConfiguration.execute({
        organizationId,
        eventId,
        actorId: actor.userId,
        expectedVersion: dto.expectedVersion,
        ...(dto.format !== undefined && { format: dto.format }),
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt !== undefined && { endsAt: new Date(dto.endsAt) }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.onlineInfo !== undefined && { onlineInfo: dto.onlineInfo }),
        ...(dto.clearOnlineInfo !== undefined && { clearOnlineInfo: dto.clearOnlineInfo }),
        ...(dto.venueId !== undefined && { venueId: dto.venueId }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      });
      return EventResponse.from(event);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      if (err instanceof EventNotInDraftError) throw new UnprocessableEntityException(err.message);
      if (err instanceof EventVersionConflictError) throw new ConflictException(err.message);
      if (err instanceof EventVenueNotFoundError) throw new UnprocessableEntityException(err.message);
      if (err instanceof EventVenueOrganizationMismatchError) throw new UnprocessableEntityException(err.message);
      if (err instanceof InvalidTimezoneError) throw new UnprocessableEntityException(err.message);
      if (err instanceof InvalidDateRangeError) throw new UnprocessableEntityException(err.message);
      if (err instanceof InvalidOnlineConfigurationUpdateError) {
        throw new BadRequestException(err.message);
      }
      if (err instanceof EventCurrencyLockedError) throw new UnprocessableEntityException(err.message);
      throw err;
    }
  }
}
