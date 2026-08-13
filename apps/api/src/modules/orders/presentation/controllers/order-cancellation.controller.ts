import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case';
import {
  InvalidReservationTokenError,
  OrderNotCancellableError,
  OrderNotFoundForCancellationError,
} from '../../domain/cancellation.errors';
import { CancelOrderAdminRequestDto, CancelOrderPublicRequestDto } from '../dto/cancel-order.request';

const TOKEN_HEX = /^[0-9a-f]{64}$/i;
const uuidPipe = new ParseUUIDPipe({ version: '4' });

interface CancellationResponse {
  orderId: string;
  status: 'CANCELLED';
  cancelledAt: string;
  ticketsCancelledCount?: number;
  requiresRefund?: boolean;
}

@ApiTags('cancellations')
@Controller()
export class OrderCancellationController {
  constructor(private readonly cancelOrder: CancelOrderUseCase) {}

  // Buyer cancels own PENDING_PAYMENT order — no organizationId required
  @Post('public/orders/:orderId/cancellations')
  @HttpCode(HttpStatus.OK)
  async cancelPublic(
    @Param('orderId', uuidPipe) orderId: string,
    @Headers('x-reservation-token') rawToken: string | undefined,
    @Body() body: CancelOrderPublicRequestDto,
  ): Promise<CancellationResponse> {
    if (!rawToken || !TOKEN_HEX.test(rawToken)) {
      throw new UnauthorizedException({ message: 'Invalid or missing reservation token', code: 'INVALID_RESERVATION_TOKEN' });
    }

    try {
      const result = await this.cancelOrder.executeByToken({
        orderId,
        reservationToken: rawToken,
        reason: body.reason,
      });
      return {
        orderId: result.orderId,
        status: result.status,
        cancelledAt: result.cancelledAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof InvalidReservationTokenError) {
        // Uniform 401 — do not reveal whether order exists
        throw new UnauthorizedException({ message: 'Invalid reservation token or order not found', code: 'INVALID_RESERVATION_TOKEN' });
      }
      if (err instanceof OrderNotCancellableError) {
        if (err.eligibilityCode === 'ORDER_ALREADY_CANCELLED') {
          throw new UnprocessableEntityException({ message: 'Order is already cancelled', code: 'ORDER_ALREADY_CANCELLED' });
        }
        throw new ConflictException({ message: 'Order cannot be cancelled', code: 'ORDER_NOT_CANCELLABLE', eligibilityCode: err.eligibilityCode });
      }
      throw err;
    }
  }

  // Admin cancels any eligible order
  @Post('organizations/:orgId/orders/:orderId/cancellations')
  @UseGuards(ActorGuard)
  @HttpCode(HttpStatus.OK)
  async cancelAdmin(
    @Param('orgId', uuidPipe) orgId: string,
    @Param('orderId', uuidPipe) orderId: string,
    @CurrentActor() actor: ICurrentActor,
    @Body() body: CancelOrderAdminRequestDto,
  ): Promise<CancellationResponse> {
    try {
      const result = await this.cancelOrder.executeByAdmin({
        orderId,
        organizationId: orgId,
        reason: body.reason,
        actorId: actor.userId,
      });
      return {
        orderId: result.orderId,
        status: result.status,
        cancelledAt: result.cancelledAt.toISOString(),
        ticketsCancelledCount: result.ticketsCancelledCount,
        requiresRefund: result.requiresRefund,
      };
    } catch (err) {
      if (err instanceof OrderNotFoundForCancellationError) {
        throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
      }
      if (err instanceof ForbiddenException) throw err;
      if (err instanceof OrderNotCancellableError) {
        if (err.eligibilityCode === 'ORDER_ALREADY_CANCELLED') {
          throw new UnprocessableEntityException({ message: 'Order is already cancelled', code: 'ORDER_ALREADY_CANCELLED' });
        }
        throw new ConflictException({ message: 'Order cannot be cancelled', code: 'ORDER_NOT_CANCELLABLE', eligibilityCode: err.eligibilityCode });
      }
      throw err;
    }
  }
}
