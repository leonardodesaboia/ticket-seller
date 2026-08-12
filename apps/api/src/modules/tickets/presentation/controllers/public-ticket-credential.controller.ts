import {
  Controller,
  Post,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
  ConflictException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IssueTicketCredentialUseCase } from '../../application/use-cases/issue-ticket-credential.use-case';
import { GetTicketCredentialUseCase } from '../../application/use-cases/get-ticket-credential.use-case';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { TicketCancelledError } from '../../domain/ticket-credential.errors';
import { CredentialResponse } from '../dto/credential.response';

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

@ApiTags('public-ticket-credentials')
@Controller('public/orders/:orderId/tickets/:ticketId/credential')
export class PublicTicketCredentialController {
  constructor(
    private readonly issueCredential: IssueTicketCredentialUseCase,
    private readonly getCredential: GetTicketCredentialUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async issue(
    @Param('orderId', uuidPipe) orderId: string,
    @Param('ticketId', uuidPipe) ticketId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<CredentialResponse> {
    try {
      const result = await this.issueCredential.execute({
        orderId,
        ticketId,
        reservationToken: requiredToken(token),
      });
      return {
        credentialToken: result.credentialToken,
        version: result.credential.version,
        ticketId,
      };
    } catch (error) {
      if (error instanceof TicketInvalidTokenError) {
        throw new UnauthorizedException({
          message: error.message,
          code: 'INVALID_RESERVATION_TOKEN',
        });
      }
      if (error instanceof TicketCancelledError) {
        throw new ConflictException({ message: error.message, code: 'TICKET_CANCELLED' });
      }
      throw error;
    }
  }

  @Get()
  async hasCredential(
    @Param('orderId', uuidPipe) orderId: string,
    @Param('ticketId', uuidPipe) ticketId: string,
    @Headers('x-reservation-token') token: string | undefined,
  ): Promise<{ hasCredential: boolean; ticketId: string }> {
    try {
      const exists = await this.getCredential.exists(orderId, ticketId, requiredToken(token));
      return { hasCredential: exists, ticketId };
    } catch (error) {
      if (error instanceof TicketInvalidTokenError) {
        throw new UnauthorizedException({
          message: error.message,
          code: 'INVALID_RESERVATION_TOKEN',
        });
      }
      throw error;
    }
  }
}
