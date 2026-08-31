import { Payout, PayoutStatus } from '../entities/payout.entity';

export const PAYOUT_REPOSITORY = Symbol('PAYOUT_REPOSITORY');

export interface IPayoutRepository {
  /**
   * Inserts a payout with ON CONFLICT (organization_id, idempotency_key) DO NOTHING.
   * Returns the payout (newly created or pre-existing) and whether it was inserted.
   */
  create(
    data: Omit<Payout, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: unknown,
  ): Promise<{ payout: Payout; inserted: boolean }>;
  findByIdempotencyKey(
    organizationId: string,
    key: string,
    tx?: unknown,
  ): Promise<Payout | null>;
  findByExternalId(externalPayoutId: string, tx?: unknown): Promise<Payout | null>;
  findProcessingOlderThan(minutes: number): Promise<Payout[]>;
  updateStatus(
    id: string,
    status: PayoutStatus,
    extra?: Partial<
      Pick<Payout, 'externalPayoutId' | 'failureReason' | 'succeededAt' | 'failedAt'>
    >,
    tx?: unknown,
  ): Promise<void>;
  updateExternalId(
    id: string,
    externalPayoutId: string,
    status: PayoutStatus,
    tx?: unknown,
  ): Promise<void>;
}
