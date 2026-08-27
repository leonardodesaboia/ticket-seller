import {
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

export class GetPlatformDashboardUseCase {
  constructor(
    private readonly dashboardRepo: IAdminDashboardRepository,
  ) {}

  async execute(): Promise<PlatformDashboard> {
    return this.dashboardRepo.getDashboardCounts();
  }
}
