import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IAdminDashboardRepository,
  PlatformDashboardCounts,
} from '../../domain/ports/admin-dashboard-repository.port';

@Injectable()
export class PrismaAdminDashboardRepository implements IAdminDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardCounts(): Promise<PlatformDashboardCounts> {
    const [
      totalOrganizations,
      totalUsers,
      totalEvents,
      activeOrders,
      pendingPayouts,
      processingPayouts,
      suspendedOrganizations,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.event.count({ where: { status: { not: 'CANCELLED' } } }),
      this.prisma.order.count({
        where: { status: { in: ['CONFIRMED', 'PROCESSING'] } },
      }),
      this.prisma.payout.count({ where: { status: 'REQUESTED' } }),
      this.prisma.payout.count({ where: { status: 'PROCESSING' } }),
      this.prisma.organization.count({
        where: { suspendedAt: { not: null }, deletedAt: null },
      }),
    ]);

    return {
      totalOrganizations,
      totalUsers,
      totalEvents,
      activeOrders,
      pendingPayouts,
      processingPayouts,
      suspendedOrganizations,
    };
  }
}
