import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  ITicketAccessForCheckInPort,
  TicketDataForCheckIn,
} from '../../application/ports/ticket-access.port';

@Injectable()
export class TicketAccessAdapter implements ITicketAccessForCheckInPort {
  constructor(private readonly prisma: PrismaService) {}

  async findTicketByCredentialHash(
    tokenHash: string,
    organizationId: string,
  ): Promise<TicketDataForCheckIn | null> {
    const rows = await this.prisma.$queryRaw<Array<{
      ticket_id: string;
      ticket_event_id: string;
      ticket_status: string;
      credential_id: string;
      credential_status: string;
      transfer_pending: boolean;
    }>>`
      SELECT
        t.id          AS ticket_id,
        t.event_id    AS ticket_event_id,
        t.status      AS ticket_status,
        tc.id         AS credential_id,
        tc.status     AS credential_status,
        EXISTS(
          SELECT 1 FROM ticket_transfers tt
          WHERE tt.ticket_id = t.id AND tt.status = 'PENDING'
        ) AS transfer_pending
      FROM ticket_credentials tc
      JOIN tickets t ON t.id = tc.ticket_id
      WHERE tc.token_hash = ${tokenHash}
        AND tc.organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      ticketId: row.ticket_id,
      ticketEventId: row.ticket_event_id,
      ticketStatus: row.ticket_status as 'ACTIVE' | 'CANCELLED',
      credentialId: row.credential_id,
      credentialStatus: row.credential_status as 'ACTIVE' | 'REVOKED',
      transferPending: Boolean(row.transfer_pending),
    };
  }
}
