export interface BalanceSettlement {
  id: string;
  orderId: string;
  organizationId: string;
  sellerNetAmount: bigint;
  currency: string;
  settledAt: Date;
  createdAt: Date;
}
