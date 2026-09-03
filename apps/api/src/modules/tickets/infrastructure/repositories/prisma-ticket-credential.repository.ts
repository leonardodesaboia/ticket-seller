import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TicketCredential, CredentialStatus } from '../../domain/ticket-credential.entity';
import {
  CreateCredentialData,
  ITicketCredentialRepository,
} from '../../domain/ports/ticket-credential-repository.port';

interface RawCredentialRow {
  id: string;
  ticket_id: string;
  organization_id: string;
  token_hash: string;
  status: string;
  version: number;
  issued_at: Date;
  revoked_at: Date | null;
}

function toEntity(row: RawCredentialRow): TicketCredential {
  return new TicketCredential({
    id: row.id,
    ticketId: row.ticket_id,
    organizationId: row.organization_id,
    tokenHash: row.token_hash,
    status: row.status as CredentialStatus,
    version: row.version,
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
  });
}

@Injectable()
export class PrismaTicketCredentialRepository implements ITicketCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByTicketId(
    ticketId: string,
    organizationId: string,
  ): Promise<TicketCredential | null> {
    const rows = await this.prisma.$queryRaw<RawCredentialRow[]>`
      SELECT id, ticket_id, organization_id, token_hash, status, version, issued_at, revoked_at
      FROM ticket_credentials
      WHERE ticket_id = ${ticketId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND status = 'ACTIVE'
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByTokenHash(tokenHash: string, organizationId: string): Promise<TicketCredential | null> {
    const rows = await this.prisma.$queryRaw<RawCredentialRow[]>`
      SELECT id, ticket_id, organization_id, token_hash, status, version, issued_at, revoked_at
      FROM ticket_credentials
      WHERE token_hash = ${tokenHash}
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async createIfNoneActive(data: CreateCredentialData): Promise<TicketCredential | null> {
    // Partial unique index on (ticket_id) WHERE status='ACTIVE' prevents duplicates
    const rows = await this.prisma.$queryRaw<RawCredentialRow[]>`
      INSERT INTO ticket_credentials (id, ticket_id, organization_id, token_hash, version)
      VALUES (
        ${data.id}::uuid, ${data.ticketId}::uuid, ${data.organizationId}::uuid,
        ${data.tokenHash}, ${data.version}
      )
      ON CONFLICT (ticket_id) WHERE status = 'ACTIVE' DO NOTHING
      RETURNING id, ticket_id, organization_id, token_hash, status, version, issued_at, revoked_at
    `;
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async rotateCredential(
    ticketId: string,
    organizationId: string,
    newData: CreateCredentialData,
  ): Promise<TicketCredential> {
    // Use an explicit transaction so the UPDATE is visible to the subsequent INSERT.
    // PostgreSQL data-modifying CTEs run concurrently and cannot see each other's effects,
    // which would violate the partial unique index. Sequential statements inside a
    // transaction are safe because each statement sees the committed effects of prior ones.
    return this.prisma.$transaction(async (tx) => {
      // Step 1: revoke all active credentials for this ticket
      await tx.$executeRaw`
        UPDATE ticket_credentials
        SET status = 'REVOKED', revoked_at = NOW()
        WHERE ticket_id = ${ticketId}::uuid
          AND organization_id = ${organizationId}::uuid
          AND status = 'ACTIVE'
      `;

      // Step 2: insert the new ACTIVE credential
      const rows = await tx.$queryRaw<RawCredentialRow[]>`
        INSERT INTO ticket_credentials (id, ticket_id, organization_id, token_hash, version)
        VALUES (
          ${newData.id}::uuid, ${newData.ticketId}::uuid, ${newData.organizationId}::uuid,
          ${newData.tokenHash}, ${newData.version}
        )
        RETURNING id, ticket_id, organization_id, token_hash, status, version, issued_at, revoked_at
      `;

      if (!rows[0]) throw new Error('rotateCredential: insert failed');
      return toEntity(rows[0]);
    });
  }
}
