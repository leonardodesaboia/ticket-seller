import {
  Controller,
  Post,
  Delete,
  Headers,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InitiateTransferUseCase } from '../../application/use-cases/initiate-transfer.use-case';
import { CancelTransferUseCase } from '../../application/use-cases/cancel-transfer.use-case';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import {
  TicketAlreadyAdmittedError,
  TransferAlreadyPendingError,
  TransferNotFoundError,
} from '../../domain/ticket-transfer.errors';
import { InitiateTransferResponse } from '../dto/transfer.dto';

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

@ApiTags('public-ticket-transfers')
@Controller('public/orders/:orderId/tickets/:ticketId/transfer')
export class TicketTransferController {
  constructor(
    private readonly initiateTransfer: InitiateTransferUseCase,
    private readonly cancelTransfer: CancelTransferUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async initiate(
    @Param('orderId', uuidPipe) orderId: string,
    @Param('ticketId', uuidPipe) ticketId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<InitiateTransferResponse> {
    try {
      const result = await this.initiateTransfer.execute({
        orderId,
        ticketId,
        reservationToken: requiredToken(token),
      });
      return {
        claimToken: result.claimToken,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof TicketInvalidTokenError) {
        throw new UnauthorizedException({
          message: error.message,
          code: 'INVALID_RESERVATION_TOKEN',
        });
      }
      if (error instanceof TicketAlreadyAdmittedError) {
        throw new ConflictException({ message: error.message, code: error.code });
      }
      if (error instanceof TransferAlreadyPendingError) {
        throw new ConflictException({ message: error.message, code: error.code });
      }
      throw error;
    }
  }

  @Delete()
  @HttpCode(204)
  async cancel(
    @Param('orderId', uuidPipe) orderId: string,
    @Param('ticketId', uuidPipe) ticketId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<void> {
    try {
      await this.cancelTransfer.execute({
        orderId,
        ticketId,
        reservationToken: requiredToken(token),
      });
    } catch (error) {
      if (error instanceof TicketInvalidTokenError) {
        throw new UnauthorizedException({
          message: error.message,
          code: 'INVALID_RESERVATION_TOKEN',
        });
      }
      if (error instanceof TransferNotFoundError) {
        throw new NotFoundException({ message: error.message, code: error.code });
      }
      throw error;
    }
  }
}
