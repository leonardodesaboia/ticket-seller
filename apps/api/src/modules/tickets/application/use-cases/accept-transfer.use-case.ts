import * as crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  TICKET_TRANSFER_REPOSITORY,
  ITicketTransferRepository,
} from '../../domain/ports/ticket-transfer-repository.port';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  TransferNotFoundError,
  TransferExpiredError,
  TransferAlreadyAcceptedError,
  TicketAlreadyAdmittedError,
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
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: AcceptTransferInput): Promise<AcceptTransferResult> {
    const hash = crypto.createHash('sha256').update(input.claimToken).digest('hex');

    const transfer = await this.transferRepo.findByClaimTokenHash(hash);
    if (!transfer) throw new TransferNotFoundError();
    if (transfer.isExpired()) throw new TransferExpiredError();
    if (!transfer.isPending()) throw new TransferAlreadyAcceptedError();

    let newCredentialToken: string;

    await this.prisma.$transaction(async (tx) => {
      // Lock the ticket row to serialize concurrent accepts
      const ticketRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM tickets
        WHERE id = ${transfer.ticketId}::uuid
        FOR UPDATE
      `;
      if (ticketRows.length === 0) {
        throw new TransferNotFoundError();
      }

      // Verify transfer is still PENDING (another concurrent transaction may have accepted it)
      const transferRows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM ticket_transfers
        WHERE id = ${transfer.id}::uuid
      `;
      if (!transferRows[0] || transferRows[0].status !== 'PENDING') {
        throw new TransferAlreadyAcceptedError();
      }

      // Check the ticket hasn't been admitted since transfer was initiated
      const admittedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM check_ins
        WHERE ticket_id = ${transfer.ticketId}::uuid
          AND result = 'ADMITTED'
        LIMIT 1
      `;
      if (admittedRows.length > 0) {
        throw new TicketAlreadyAdmittedError(transfer.ticketId);
      }

      // Revoke existing active credentials for this ticket
      await tx.$executeRaw`
        UPDATE ticket_credentials
        SET status = 'REVOKED', revoked_at = NOW()
        WHERE ticket_id = ${transfer.ticketId}::uuid
          AND status = 'ACTIVE'
      `;

      // Generate new credential token
      const newToken = crypto.randomBytes(32).toString('hex');
      const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
      const newCredentialId = crypto.randomUUID();

      // Determine next version
      const versionRows = await tx.$queryRaw<Array<{ max_version: number | null }>>`
        SELECT MAX(version) AS max_version FROM ticket_credentials
        WHERE ticket_id = ${transfer.ticketId}::uuid
      `;
      const maxVersion = versionRows[0]?.max_version ?? 0;
      const newVersion = (maxVersion ?? 0) + 1;

      // Insert new credential
      await tx.$executeRaw`
        INSERT INTO ticket_credentials (id, ticket_id, organization_id, token_hash, version)
        VALUES (
          ${newCredentialId}::uuid,
          ${transfer.ticketId}::uuid,
          ${transfer.organizationId}::uuid,
          ${newTokenHash},
          ${newVersion}
        )
      `;

      // Mark transfer as accepted
      await tx.$executeRaw`
        UPDATE ticket_transfers
        SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
        WHERE id = ${transfer.id}::uuid
      `;

      newCredentialToken = newToken;
    });

    // TypeScript narrowing — the transaction above always assigns this
    return { newCredentialToken: newCredentialToken! };
  }
}
