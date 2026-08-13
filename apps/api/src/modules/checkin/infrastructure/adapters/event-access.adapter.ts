import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { EventForCheckIn, IEventAccessForCheckInPort } from '../../application/ports/event-access.port';

@Injectable()
export class EventAccessAdapter implements IEventAccessForCheckInPort {
  constructor(private readonly prisma: PrismaService) {}

  async findEventForCheckIn(eventId: string, organizationId: string): Promise<EventForCheckIn | null> {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      organization_id: string;
      status: string;
    }>>`
      SELECT id, organization_id, status
      FROM events
      WHERE id = ${eventId}::uuid
        AND organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      status: row.status,
    };
  }
}
