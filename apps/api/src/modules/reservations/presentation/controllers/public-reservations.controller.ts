import {
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  GoneException,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReservationThrottle } from '../../../../platform/http/decorators/throttle.decorator';
import { CancelReservationUseCase } from '../../application/use-cases/cancel-reservation.use-case';
import { CreateReservationUseCase } from '../../application/use-cases/create-reservation.use-case';
import { GetReservationUseCase } from '../../application/use-cases/get-reservation.use-case';
import {
  EventNotFoundForReservationError,
  EventNotPublishedForReservationError,
  InsufficientInventoryForReservationError,
  InvalidReservationTokenError,
  ReservationAlreadyConsumedError,
  ReservationExpiredError,
  ReservationIdempotencyConflictError,
  ReservationNotFoundError,
  TicketTypeInactiveForReservationError,
  TicketTypeNotFoundForReservationError,
} from '../../domain/reservation.errors';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ReservationResponse } from '../dto/reservation.response';

const uuidPipe = new ParseUUIDPipe({ version: '4' });
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_HEX = /^[0-9a-f]{64}$/i;

function requiredToken(value: string | undefined): string {
  if (!value || !TOKEN_HEX.test(value)) {
    throw new UnauthorizedException({ message: 'Invalid reservation token', code: 'INVALID_RESERVATION_TOKEN' });
  }
  return value;
}

function reservationItems(value: unknown): Array<{ ticketTypeId: string; quantity: number }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException({ message: 'Items must not be empty', code: 'INVALID_ITEMS' });
  }
  const items = value.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new BadRequestException({ message: 'Invalid reservation items', code: 'INVALID_ITEMS' });
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record['ticketTypeId'] !== 'string' ||
      !UUID_V4.test(record['ticketTypeId']) ||
      typeof record['quantity'] !== 'number' ||
      !Number.isInteger(record['quantity']) ||
      record['quantity'] <= 0
    ) {
      throw new BadRequestException({ message: 'Invalid reservation items', code: 'INVALID_ITEMS' });
    }
    return { ticketTypeId: record['ticketTypeId'], quantity: record['quantity'] };
  });
  return items;
}

@ApiTags('public-reservations')
@Controller('public/reservations')
export class PublicReservationsController {
  constructor(
    private readonly createReservation: CreateReservationUseCase,
    private readonly getReservation: GetReservationUseCase,
    private readonly cancelReservation: CancelReservationUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ReservationThrottle()
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponse> {
    if (!idempotencyKey || !UUID_V4.test(idempotencyKey)) {
      throw new UnprocessableEntityException({ message: 'Idempotency-Key must be a UUID v4', code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    try {
      const result = await this.createReservation.execute({
        eventSlug: dto.eventSlug,
        items: reservationItems(dto.items),
        idempotencyKey,
      });
      return ReservationResponse.from(result.reservation, result.token);
    } catch (error) {
      if (error instanceof EventNotFoundForReservationError) throw new NotFoundException({ message: error.message, code: 'EVENT_NOT_FOUND' });
      if (error instanceof TicketTypeNotFoundForReservationError) throw new NotFoundException({ message: error.message, code: 'TICKET_TYPE_NOT_FOUND' });
      if (error instanceof EventNotPublishedForReservationError) throw new UnprocessableEntityException({ message: error.message, code: 'EVENT_NOT_PUBLISHED' });
      if (error instanceof TicketTypeInactiveForReservationError) throw new UnprocessableEntityException({ message: error.message, code: 'TICKET_TYPE_INACTIVE' });
      if (error instanceof InsufficientInventoryForReservationError) throw new UnprocessableEntityException({ message: error.message, code: 'INSUFFICIENT_INVENTORY' });
      if (error instanceof ReservationIdempotencyConflictError) throw new ConflictException({ message: error.message, code: 'IDEMPOTENCY_CONFLICT' });
      throw error;
    }
  }

  @Get(':reservationId')
  async get(
    @Param('reservationId', uuidPipe) reservationId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<ReservationResponse> {
    try {
      return ReservationResponse.from(await this.getReservation.execute(reservationId, requiredToken(token)));
    } catch (error) {
      this.throwAccessError(error);
    }
  }

  @Delete(':reservationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('reservationId', uuidPipe) reservationId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<void> {
    try {
      await this.cancelReservation.execute(reservationId, requiredToken(token));
    } catch (error) {
      this.throwAccessError(error);
    }
  }

  private throwAccessError(error: unknown): never {
    if (error instanceof InvalidReservationTokenError) throw new UnauthorizedException({ message: error.message, code: 'INVALID_RESERVATION_TOKEN' });
    if (error instanceof ReservationNotFoundError) throw new NotFoundException(error.message);
    if (error instanceof ReservationExpiredError) {
      throw new GoneException({ message: error.message, code: 'RESERVATION_EXPIRED' });
    }
    if (error instanceof ReservationAlreadyConsumedError) throw new ConflictException({ message: error.message, code: 'RESERVATION_ALREADY_CONSUMED' });
    throw error;
  }
}
