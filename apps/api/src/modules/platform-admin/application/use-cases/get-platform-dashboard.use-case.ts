import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface PlatformDashboard {
  totalOrganizations: number;
  totalUsers: number;
  totalEvents: number;
  activeOrders: number;
  pendingPayouts: number;
  processingPayouts: number;
  suspendedOrganizations: number;
}

@Injectable()
export class GetPlatformDashboardUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PlatformDashboard> {
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
      this.prisma.event.count(),
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
