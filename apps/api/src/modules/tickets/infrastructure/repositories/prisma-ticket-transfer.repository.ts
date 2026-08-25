import * as nodeCrypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TicketTransfer, TransferStatus } from '../../domain/ticket-transfer.entity';
import {
  AcceptAtomicParams,
  CreateTransferData,
  ITicketTransferRepository,
  PrismaTransactionClient,
} from '../../domain/ports/ticket-transfer-repository.port';
import { TransferAlreadyAcceptedError, TicketAlreadyAdmittedError, TransferExpiredError } from '../../domain/ticket-transfer.errors';

interface RawTransferRow {
  id: string;
  ticket_id: string;
  organization_id: string;
  claim_token_hash: string;
  status: string;
  expires_at: Date;
  accepted_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
}

function toEntity(row: RawTransferRow): TicketTransfer {
  return new TicketTransfer({
    id: row.id,
    ticketId: row.ticket_id,
    organizationId: row.organization_id,
    claimTokenHash: row.claim_token_hash,
    status: row.status as TransferStatus,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  });
}

@Injectable()
export class PrismaTicketTransferRepository implements ITicketTransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingByTicketId(
    ticketId: string,
    organizationId: string,
  ): Promise<TicketTransfer | null> {
    const rows = await this.prisma.$queryRaw<RawTransferRow[]>`
      SELECT * FROM ticket_transfers
      WHERE ticket_id = ${ticketId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND status = 'PENDING'
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByClaimTokenHash(hash: string): Promise<TicketTransfer | null> {
    const rows = await this.prisma.$queryRaw<RawTransferRow[]>`
      SELECT * FROM ticket_transfers
      WHERE claim_token_hash = ${hash}
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(data: CreateTransferData): Promise<TicketTransfer> {
    const rows = await this.prisma.$queryRaw<RawTransferRow[]>`
      INSERT INTO ticket_transfers (id, ticket_id, organization_id, claim_token_hash, expires_at)
      VALUES (
        ${data.id}::uuid,
        ${data.ticketId}::uuid,
        ${data.organizationId}::uuid,
        ${data.claimTokenHash},
        ${data.expiresAt}
      )
      RETURNING *
    `;
    if (!rows[0]) throw new Error('create: insert failed');
    return toEntity(rows[0]);
  }

  async cancel(id: string): Promise<void> {
    const affected = await this.prisma.$executeRaw`
      UPDATE ticket_transfers
      SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'PENDING'
    `;
    if (affected === 0) {
      throw new TransferAlreadyAcceptedError();
    }
  }

  async accept(id: string, tx?: PrismaTransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.$executeRaw`
      UPDATE ticket_transfers
      SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async acceptAtomically(params: AcceptAtomicParams): Promise<string> {
    let newCredentialToken!: string;

    await this.prisma.$transaction(async (tx) => {
      // Lock ticket row
      const ticketRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM tickets WHERE id = ${params.ticketId}::uuid FOR UPDATE
      `;
      if (!ticketRows[0]) throw new Error('ticket not found');

      // Re-verify transfer still PENDING and not expired inside the transaction
      const transferRows = await tx.$queryRaw<Array<{ status: string; expires_at: Date }>>`
        SELECT status, expires_at FROM ticket_transfers WHERE id = ${params.transferId}::uuid FOR UPDATE
      `;
      if (!transferRows[0] || transferRows[0].status !== 'PENDING') {
        throw new TransferAlreadyAcceptedError();
      }
      if (transferRows[0].expires_at <= new Date()) {
        throw new TransferExpiredError();
      }

      // Check admitted
      const admittedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM check_ins
        WHERE ticket_id = ${params.ticketId}::uuid AND result = 'ADMITTED'
        LIMIT 1
      `;
      if (admittedRows.length > 0) {
        throw new TicketAlreadyAdmittedError(params.ticketId);
      }

      // Revoke existing active credentials
      await tx.$executeRaw`
        UPDATE ticket_credentials
        SET status = 'REVOKED', revoked_at = NOW()
        WHERE ticket_id = ${params.ticketId}::uuid AND status = 'ACTIVE'
      `;

      // Generate and insert new credential
      const newToken = nodeCrypto.randomBytes(32).toString('hex');
      const newTokenHash = nodeCrypto.createHash('sha256').update(newToken).digest('hex');
      const newCredentialId = nodeCrypto.randomUUID();

      const versionRows = await tx.$queryRaw<Array<{ max_version: number | null }>>`
        SELECT MAX(version) AS max_version FROM ticket_credentials
        WHERE ticket_id = ${params.ticketId}::uuid
      `;
      const newVersion = (versionRows[0]?.max_version ?? 0) + 1;

      await tx.$executeRaw`
        INSERT INTO ticket_credentials (id, ticket_id, organization_id, token_hash, version)
        VALUES (
          ${newCredentialId}::uuid, ${params.ticketId}::uuid,
          ${params.organizationId}::uuid, ${newTokenHash}, ${newVersion}
        )
      `;

      // Accept the transfer
      await tx.$executeRaw`
        UPDATE ticket_transfers
        SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
        WHERE id = ${params.transferId}::uuid
      `;

      newCredentialToken = newToken;
    });

    return newCredentialToken;
  }
}
