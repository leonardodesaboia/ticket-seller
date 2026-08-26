export const ADMIN_PAYOUT_REPOSITORY = 'ADMIN_PAYOUT_REPOSITORY';

export interface AdminPayoutRecord {
  id: string;
  status: string;
}

export interface IAdminPayoutRepository {
  findById(id: string): Promise<AdminPayoutRecord | null>;
  blockIfBlockable(id: string, blockableStatuses: string[]): Promise<{ count: number }>;
}
