import {
  Controller,
  Post,
  Param,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AcceptTransferUseCase } from '../../application/use-cases/accept-transfer.use-case';
import {
  TransferNotFoundError,
  TransferExpiredError,
  TransferAlreadyAcceptedError,
  TicketAlreadyAdmittedError,
} from '../../domain/ticket-transfer.errors';
import { AcceptTransferResponse } from '../dto/transfer.dto';

const TOKEN_HEX = /^[0-9a-f]{64}$/i;

@ApiTags('public-transfer-accept')
@Controller('public/transfers')
export class PublicTransferAcceptController {
  constructor(private readonly acceptTransfer: AcceptTransferUseCase) {}

  @Post(':claimToken/accept')
  @HttpCode(200)
  async accept(@Param('claimToken') claimToken: string): Promise<AcceptTransferResponse> {
    if (!TOKEN_HEX.test(claimToken)) {
      throw new NotFoundException({ message: 'Transfer not found', code: 'TRANSFER_NOT_FOUND' });
    }
    try {
      const result = await this.acceptTransfer.execute({ claimToken });
      return { newCredentialToken: result.newCredentialToken };
    } catch (error) {
      if (error instanceof TransferNotFoundError) {
        throw new NotFoundException({ message: error.message, code: error.code });
      }
      if (error instanceof TransferExpiredError) {
        throw new BadRequestException({ message: error.message, code: error.code });
      }
      if (error instanceof TransferAlreadyAcceptedError) {
        throw new ConflictException({ message: error.message, code: error.code });
      }
      if (error instanceof TicketAlreadyAdmittedError) {
        throw new ConflictException({ message: error.message, code: error.code });
      }
      throw error;
    }
  }
}
