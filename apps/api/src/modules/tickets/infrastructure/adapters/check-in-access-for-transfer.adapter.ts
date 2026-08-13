import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { ICheckInAccessForTransferPort } from '../../application/ports/check-in-access-for-transfer.port';

@Injectable()
export class CheckInAccessForTransferAdapter implements ICheckInAccessForTransferPort {
  constructor(private readonly prisma: PrismaService) {}

  async hasAdmittedCheckIn(ticketId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM check_ins
      WHERE ticket_id = ${ticketId}::uuid
        AND result = 'ADMITTED'
      LIMIT 1
    `;
    return rows.length > 0;
  }
}
