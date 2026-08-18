import { SellerBalance } from '../entities/seller-balance.entity';

export const SELLER_BALANCE_REPOSITORY = Symbol('SELLER_BALANCE_REPOSITORY');

export interface ISellerBalanceRepository {
  findByOrg(organizationId: string, tx?: unknown): Promise<SellerBalance | null>;
  findByOrgForUpdate(organizationId: string, tx?: unknown): Promise<SellerBalance | null>;
  upsertIncrementPending(
    organizationId: string,
    currency: string,
    amount: bigint,
    tx?: unknown,
  ): Promise<void>;
  decrementPendingIncrementAvailable(
    organizationId: string,
    amount: bigint,
    version: number,
    tx?: unknown,
  ): Promise<void>;
  decrementAvailable(organizationId: string, amount: bigint, tx?: unknown): Promise<void>;
  decrementPending(organizationId: string, amount: bigint, tx?: unknown): Promise<void>;
  incrementReserved(organizationId: string, amount: bigint, tx?: unknown): Promise<void>;
  decrementReserved(organizationId: string, amount: bigint, tx?: unknown): Promise<void>;
}
