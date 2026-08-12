import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrderTicketsUseCase } from '../../application/use-cases/get-order-tickets.use-case';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { TicketsResponse } from '../dto/ticket.response';

const TOKEN_HEX = /^[0-9a-f]{64}$/i;

function requiredToken(value: string | undefined): string {
  if (!value || !TOKEN_HEX.test(value)) {
    throw new UnauthorizedException({ message: 'Invalid reservation token', code: 'INVALID_RESERVATION_TOKEN' });
  }
  return value;
}

@ApiTags('public-tickets')
@Controller('public/orders/:orderId/tickets')
export class PublicTicketsController {
  constructor(private readonly getOrderTickets: GetOrderTicketsUseCase) {}

  @Get()
  async listOrderTickets(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<TicketsResponse> {
    try {
      const tickets = await this.getOrderTickets.execute(orderId, requiredToken(token));
      return TicketsResponse.from(orderId, tickets);
    } catch (error) {
      if (error instanceof TicketInvalidTokenError) {
        throw new UnauthorizedException({ message: error.message, code: 'INVALID_RESERVATION_TOKEN' });
      }
      throw error;
    }
  }
}
