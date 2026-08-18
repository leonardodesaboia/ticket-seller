export interface SellerBalance {
  id: string;
  organizationId: string;
  pendingAmount: bigint;
  availableAmount: bigint;
  reservedAmount: bigint;
  currency: string;
  version: number;
  updatedAt: Date;
  createdAt: Date;
}
