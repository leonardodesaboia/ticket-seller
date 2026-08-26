export const ADMIN_DASHBOARD_REPOSITORY = 'ADMIN_DASHBOARD_REPOSITORY';

export interface PlatformDashboardCounts {
  totalOrganizations: number;
  totalUsers: number;
  totalEvents: number;
  activeOrders: number;
  pendingPayouts: number;
  processingPayouts: number;
  suspendedOrganizations: number;
}

export interface IAdminDashboardRepository {
  getDashboardCounts(): Promise<PlatformDashboardCounts>;
}
