import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TicketTransfer, TransferStatus } from '../../domain/ticket-transfer.entity';
import {
  CreateTransferData,
  ITicketTransferRepository,
  PrismaTransactionClient,
} from '../../domain/ports/ticket-transfer-repository.port';

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
    await this.prisma.$executeRaw`
      UPDATE ticket_transfers
      SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async accept(id: string, tx?: PrismaTransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.$executeRaw`
      UPDATE ticket_transfers
      SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }
}
