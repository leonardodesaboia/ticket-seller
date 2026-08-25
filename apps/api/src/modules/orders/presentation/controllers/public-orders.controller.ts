import {
  Body,
  ConflictException,
  Controller,
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
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';
import {
  InvalidReservationTokenForOrderError,
  OrderAlreadyExistsError,
  OrderIdempotencyConflictError,
  OrderNotFoundError,
  ReservationAlreadyConsumedForOrderError,
  ReservationCancelledForOrderError,
  ReservationExpiredForOrderError,
  ReservationNotFoundForOrderError,
} from '../../domain/order.errors';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderResponse } from '../dto/order.response';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_HEX = /^[0-9a-f]{64}$/i;
const uuidPipe = new ParseUUIDPipe({ version: '4' });

function requiredToken(value: string | undefined): string {
  if (!value || !TOKEN_HEX.test(value)) {
    throw new UnauthorizedException({ message: 'Invalid reservation token', code: 'INVALID_RESERVATION_TOKEN' });
  }
  return value;
}

@ApiTags('public-orders')
@Controller('public/orders')
export class PublicOrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-reservation-token') token: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponse> {
    if (!idempotencyKey || !UUID_V4.test(idempotencyKey)) {
      throw new UnprocessableEntityException({ message: 'Idempotency-Key must be a UUID v4', code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    try {
      return OrderResponse.from(await this.createOrder.execute({
        reservationId: dto.reservationId,
        reservationToken: requiredToken(token),
        idempotencyKey,
        buyerEmail: dto.buyerEmail,
      }));
    } catch (error) {
      this.throwAccessError(error);
    }
  }

  @Get(':orderId')
  async get(
    @Param('orderId', uuidPipe) orderId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<OrderResponse> {
    try {
      return OrderResponse.from(await this.getOrder.execute(orderId, requiredToken(token)));
    } catch (error) {
      this.throwAccessError(error);
    }
  }

  private throwAccessError(error: unknown): never {
    if (error instanceof InvalidReservationTokenForOrderError) throw new UnauthorizedException({ message: error.message, code: 'INVALID_RESERVATION_TOKEN' });
    if (error instanceof ReservationNotFoundForOrderError) throw new NotFoundException({ message: error.message, code: 'RESERVATION_NOT_FOUND' });
    if (error instanceof OrderNotFoundError) throw new NotFoundException({ message: error.message, code: 'ORDER_NOT_FOUND' });
    if (error instanceof ReservationExpiredForOrderError) throw new GoneException({ message: error.message, code: 'RESERVATION_EXPIRED' });
    if (error instanceof ReservationCancelledForOrderError) throw new UnprocessableEntityException({ message: error.message, code: 'RESERVATION_CANCELLED' });
    if (error instanceof ReservationAlreadyConsumedForOrderError) throw new UnprocessableEntityException({ message: error.message, code: 'RESERVATION_ALREADY_CONSUMED' });
    if (error instanceof OrderAlreadyExistsError) throw new ConflictException({ message: error.message, code: 'ORDER_ALREADY_EXISTS' });
    if (error instanceof OrderIdempotencyConflictError) throw new ConflictException({ message: error.message, code: 'IDEMPOTENCY_CONFLICT' });
    throw error;
  }
}
