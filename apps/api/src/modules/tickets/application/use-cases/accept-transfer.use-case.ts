import * as crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  TICKET_TRANSFER_REPOSITORY,
  ITicketTransferRepository,
  AcceptAtomicParams,
} from '../../domain/ports/ticket-transfer-repository.port';
import {
  TransferNotFoundError,
  TransferExpiredError,
  TransferAlreadyAcceptedError,
} from '../../domain/ticket-transfer.errors';

export interface AcceptTransferInput {
  claimToken: string;
}

export interface AcceptTransferResult {
  newCredentialToken: string;
}

@Injectable()
export class AcceptTransferUseCase {
  constructor(
    @Inject(TICKET_TRANSFER_REPOSITORY)
    private readonly transferRepo: ITicketTransferRepository,
  ) {}

  async execute(input: AcceptTransferInput): Promise<AcceptTransferResult> {
    const hash = crypto.createHash('sha256').update(input.claimToken).digest('hex');

    const transfer = await this.transferRepo.findByClaimTokenHash(hash);
    if (!transfer) throw new TransferNotFoundError();
    if (transfer.isExpired()) throw new TransferExpiredError();
    if (!transfer.isPending()) throw new TransferAlreadyAcceptedError();

    const newCredentialToken = await this.transferRepo.acceptAtomically({
      transferId: transfer.id,
      ticketId: transfer.ticketId,
      organizationId: transfer.organizationId,
    } satisfies AcceptAtomicParams);

    return { newCredentialToken };
  }
}
