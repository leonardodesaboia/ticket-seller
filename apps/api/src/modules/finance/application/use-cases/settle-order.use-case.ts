import {
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import { ILogger } from '../../../../shared/kernel/logger.port';
import { IFinanceTransactionRunner } from '../ports/finance-transaction-runner.port';

export interface SettleOrderInput {
  orderId: string;
  organizationId: string;
  sellerNetAmount: bigint;
  currency: string;
}

export class SettleOrderUseCase {
  constructor(
    private readonly transactionRunner: IFinanceTransactionRunner,
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * Atomically settles a single order:
   * 1. SELECT FOR UPDATE on seller_balance to serialize concurrent settlements.
   * 2. INSERT balance_settlement (ON CONFLICT DO NOTHING — idempotent).
   * 3. If inserted: atomically UPDATE seller_balance: pending -= sellerNet, available += sellerNet.
   * 4. If already existed: no-op.
   * Returns true if settlement was applied, false if already processed.
   */
  async execute(input: SettleOrderInput): Promise<boolean> {
    const { orderId, organizationId, sellerNetAmount, currency } = input;

    return this.transactionRunner.run(async (tx) => {
      const txRaw = tx as { $executeRaw: (...args: unknown[]) => Promise<number> };

      // 1. Lock the seller_balance row — prevents concurrent settlement updates for same org
      await this.sellerBalanceRepo.findByOrgForUpdate(organizationId, tx);

      // 2. Insert settlement record (idempotent via UNIQUE(order_id))
      const rowsAffected = await txRaw.$executeRaw`
        INSERT INTO balance_settlements (order_id, organization_id, seller_net_amount, currency)
        VALUES (${orderId}::uuid, ${organizationId}::uuid, ${sellerNetAmount}, ${currency})
        ON CONFLICT (order_id) DO NOTHING
      `;

      if (rowsAffected === 0) {
        this.logger.log(
          `Settlement for orderId=${orderId} already exists — skipping (idempotent)`,
        );
        return false;
      }

      // 3. Atomically move pending → available.
      // Guard pending_amount >= sellerNetAmount: if a refund already decremented pending before
      // settlement ran, the balance is already correct and we should not over-decrement.
      const balanceRows = await txRaw.$executeRaw`
        UPDATE seller_balances
        SET pending_amount   = pending_amount   - ${sellerNetAmount},
            available_amount = available_amount + ${sellerNetAmount},
            version          = version + 1,
            updated_at       = NOW()
        WHERE organization_id = ${organizationId}::uuid
          AND pending_amount >= ${sellerNetAmount}
      `;

      if (balanceRows === 0) {
        this.logger.warn(
          `Settled orderId=${orderId}: pending_amount < sellerNet=${sellerNetAmount} — refund may have already adjusted balance for org=${organizationId}`,
        );
      } else {
        this.logger.log(
          `Settled orderId=${orderId}: sellerNet=${sellerNetAmount} ${currency} moved pending→available for org=${organizationId}`,
        );
      }
      return true;
    });
  }
}
