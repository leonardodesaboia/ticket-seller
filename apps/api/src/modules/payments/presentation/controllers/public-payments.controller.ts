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
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePaymentAttemptUseCase } from '../../application/use-cases/create-payment-attempt.use-case';
import { GetPaymentAttemptUseCase } from '../../application/use-cases/get-payment-attempt.use-case';
import {
  InvalidReservationTokenForPaymentError,
  OrderExpiredForPaymentError,
  OrderNotFoundForPaymentError,
  OrderNotPendingPaymentError,
  PaymentAlreadyActiveError,
  PaymentAttemptNotFoundError,
  PaymentIdempotencyConflictError,
  UnsupportedPaymentMethodError,
} from '../../domain/payment-attempt.errors';
import { GatewayError } from '../../domain/payment-gateway.errors';
import { CreatePaymentAttemptDto } from '../dto/create-payment-attempt.dto';
import { PaymentAttemptResponse } from '../dto/payment-attempt.response';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_HEX = /^[0-9a-f]{64}$/i;
const uuidPipe = new ParseUUIDPipe({ version: '4' });

function requiredToken(value: string | undefined): string {
  if (!value || !TOKEN_HEX.test(value)) {
    throw new UnauthorizedException({
      message: 'Invalid reservation token',
      code: 'INVALID_RESERVATION_TOKEN',
    });
  }
  return value;
}

@ApiTags('public-payments')
@Controller('public/orders/:orderId/payments')
export class PublicPaymentsController {
  constructor(
    private readonly createAttempt: CreatePaymentAttemptUseCase,
    private readonly getAttempt: GetPaymentAttemptUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('orderId', uuidPipe) orderId: string,
    @Headers('x-reservation-token') token: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentAttemptDto,
  ): Promise<PaymentAttemptResponse> {
    if (!idempotencyKey || !UUID_V4.test(idempotencyKey)) {
      throw new UnprocessableEntityException({
        message: 'Idempotency-Key must be a UUID v4',
        code: 'INVALID_IDEMPOTENCY_KEY',
      });
    }
    try {
      const attempt = await this.createAttempt.execute({
        orderId,
        reservationToken: requiredToken(token),
        idempotencyKey,
        paymentMethod: dto.paymentMethod,
      });
      return PaymentAttemptResponse.from(attempt);
    } catch (error) {
      this.mapError(error);
    }
  }

  @Get('latest')
  async getLatest(
    @Param('orderId', uuidPipe) orderId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<PaymentAttemptResponse> {
    try {
      const attempt = await this.getAttempt.execute(orderId, requiredToken(token));
      return PaymentAttemptResponse.from(attempt);
    } catch (error) {
      this.mapError(error);
    }
  }

  private mapError(error: unknown): never {
    if (error instanceof InvalidReservationTokenForPaymentError)
      throw new UnauthorizedException({ message: error.message, code: 'INVALID_RESERVATION_TOKEN' });
    if (error instanceof OrderNotFoundForPaymentError)
      throw new NotFoundException({ message: error.message, code: 'ORDER_NOT_FOUND' });
    if (error instanceof OrderExpiredForPaymentError)
      throw new GoneException({ message: error.message, code: 'ORDER_EXPIRED' });
    if (error instanceof OrderNotPendingPaymentError)
      throw new UnprocessableEntityException({
        message: error.message,
        code: 'ORDER_NOT_PENDING_PAYMENT',
      });
    if (error instanceof PaymentAlreadyActiveError)
      throw new ConflictException({ message: error.message, code: 'PAYMENT_ALREADY_ACTIVE' });
    if (error instanceof UnsupportedPaymentMethodError)
      throw new UnprocessableEntityException({
        message: error.message,
        code: 'INVALID_PAYMENT_METHOD',
      });
    if (error instanceof PaymentIdempotencyConflictError)
      throw new ConflictException({ message: error.message, code: 'IDEMPOTENCY_CONFLICT' });
    if (error instanceof PaymentAttemptNotFoundError)
      throw new NotFoundException({ message: error.message, code: 'PAYMENT_ATTEMPT_NOT_FOUND' });
    if (error instanceof GatewayError)
      throw new ServiceUnavailableException({
        message: 'Payment gateway unavailable',
        code: 'GATEWAY_ERROR',
      });
    throw error;
  }
}
