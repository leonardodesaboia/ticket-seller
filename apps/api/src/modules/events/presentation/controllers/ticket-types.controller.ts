import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { CreateTicketTypeUseCase } from '../../application/use-cases/ticket-types/create-ticket-type.use-case';
import { IdempotencyKeyConflictError } from '../../application/errors/idempotency-key-conflict.error';
import { ListEventTicketTypesUseCase } from '../../application/use-cases/ticket-types/list-event-ticket-types.use-case';
import { UpdateTicketTypeUseCase } from '../../application/use-cases/ticket-types/update-ticket-type.use-case';
import {
  EventNotFoundError,
  EventNotInDraftError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import {
  EventCurrencyNotSetError,
  TicketTypeNotFoundError,
  TicketTypeVersionConflictError,
} from '../../domain/ticket-types/ticket-type.errors';
import { CreateTicketTypeDto } from '../dto/ticket-types/create-ticket-type.dto';
import { UpdateTicketTypeDto } from '../dto/ticket-types/update-ticket-type.dto';
import { TicketTypeResponse } from '../dto/ticket-types/ticket-type.response';

const uuidPipe = new ParseUUIDPipe({ version: '4' });
const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

@ApiTags('ticket-types')
@Controller('organizations/:organizationId/events/:eventId/ticket-types')
@UseGuards(ActorGuard)
export class TicketTypesController {
  constructor(
    private readonly createTicketType: CreateTicketTypeUseCase,
    private readonly listTicketTypes: ListEventTicketTypesUseCase,
    private readonly updateTicketType: UpdateTicketTypeUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Param('eventId', uuidPipe) eventId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateTicketTypeDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<TicketTypeResponse> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (
      !normalizedIdempotencyKey ||
      normalizedIdempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
      hasControlCharacters(normalizedIdempotencyKey)
    ) {
      throw new UnprocessableEntityException(
        'Idempotency-Key must contain 1 to 255 printable characters',
      );
    }
    try {
      const { ticketType } = await this.createTicketType.execute({
        organizationId,
        eventId,
        actorId: actor.userId,
        idempotencyKey: normalizedIdempotencyKey,
        name: dto.name,
        description: dto.description ?? null,
        priceAmount: dto.priceAmount,
        capacity: dto.capacity,
      });
      return TicketTypeResponse.from(ticketType);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      if (err instanceof EventNotInDraftError) throw new UnprocessableEntityException(err.message);
      if (err instanceof EventCurrencyNotSetError) throw new UnprocessableEntityException(err.message);
      if (err instanceof IdempotencyKeyConflictError) throw new ConflictException(err.message);
      throw err;
    }
  }

  @Get()
  async list(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Param('eventId', uuidPipe) eventId: string,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<{ data: TicketTypeResponse[] }> {
    try {
      const ticketTypes = await this.listTicketTypes.execute({
        organizationId,
        eventId,
        actorId: actor.userId,
      });
      return { data: ticketTypes.map((tt) => TicketTypeResponse.from(tt)) };
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Patch(':ticketTypeId')
  async update(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Param('eventId', uuidPipe) eventId: string,
    @Param('ticketTypeId', uuidPipe) ticketTypeId: string,
    @Body() dto: UpdateTicketTypeDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<TicketTypeResponse> {
    try {
      const ticketType = await this.updateTicketType.execute({
        organizationId,
        eventId,
        ticketTypeId,
        actorId: actor.userId,
        expectedVersion: dto.expectedVersion,
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priceAmount !== undefined && { priceAmount: dto.priceAmount }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.status !== undefined && { status: dto.status }),
      });
      return TicketTypeResponse.from(ticketType);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof TicketTypeNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      if (err instanceof EventNotInDraftError) throw new UnprocessableEntityException(err.message);
      if (err instanceof TicketTypeVersionConflictError) throw new ConflictException(err.message);
      throw err;
    }
  }
}
