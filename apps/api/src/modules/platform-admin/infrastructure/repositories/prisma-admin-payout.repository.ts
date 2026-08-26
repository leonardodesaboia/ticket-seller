import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IAdminPayoutRepository,
  AdminPayoutRecord,
} from '../../domain/ports/admin-payout-repository.port';

@Injectable()
export class PrismaAdminPayoutRepository implements IAdminPayoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AdminPayoutRecord | null> {
    return this.prisma.payout.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
  }

  async blockIfBlockable(id: string, blockableStatuses: string[]): Promise<{ count: number }> {
    return this.prisma.payout.updateMany({
      where: { id, status: { in: blockableStatuses } },
      data: { status: 'BLOCKED' },
    });
  }
}
