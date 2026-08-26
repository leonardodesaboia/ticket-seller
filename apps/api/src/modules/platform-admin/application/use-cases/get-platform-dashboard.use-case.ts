import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_DASHBOARD_REPOSITORY,
  IAdminDashboardRepository,
} from '../../domain/ports/admin-dashboard-repository.port';

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
  constructor(
    @Inject(ADMIN_DASHBOARD_REPOSITORY)
    private readonly dashboardRepo: IAdminDashboardRepository,
  ) {}

  async execute(): Promise<PlatformDashboard> {
    return this.dashboardRepo.getDashboardCounts();
  }
}
