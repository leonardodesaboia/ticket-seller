import {
  ILedgerRepository,
} from '../../domain/ports/ledger.repository.port';
import {
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import { ILogger } from '../../../../shared/kernel/logger.port';
import { IOrderSettlementQueryPort } from '../ports/order-settlement-query.port';

export interface RecordChargebackInput {
  orderId: string;
  organizationId: string;
  chargebackAmount: bigint;
  currency: string;
  tx?: unknown;
}

export class RecordChargebackUseCase {
  constructor(
    private readonly ledgerRepository: ILedgerRepository,
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
    private readonly orderSettlementQuery: IOrderSettlementQueryPort,
    private readonly logger: ILogger,
  ) {}

  async execute(input: RecordChargebackInput): Promise<void> {
    const { orderId, organizationId, chargebackAmount, currency, tx } = input;

    if (chargebackAmount <= 0n) {
      this.logger.warn(
        `Chargeback amount is zero or negative for orderId=${orderId} — skipping ledger entry`,
      );
      return;
    }

    // Resolve platform clearing account
    const platformClearing = await this.ledgerRepository.findAccountByCode(
      'PLATFORM_CLEARING',
      tx,
    );
    if (!platformClearing) {
      throw new Error('PLATFORM_CLEARING account not found — check seed migration');
    }

    // Find or create org-scoped SELLER_PAYABLE account
    // Note: chargeback can drive SELLER_PAYABLE balance negative (producer owes platform)
    const sellerPayable = await this.ledgerRepository.findOrCreateOrgAccount(
      `SELLER_PAYABLE:${organizationId}`,
      'Seller Payable',
      'LIABILITY',
      organizationId,
      currency,
      tx,
    );

    // Double-entry: DEBIT SELLER_PAYABLE, CREDIT PLATFORM_CLEARING
    // This reduces the platform's obligation to the producer (or creates a debt)
    await this.ledgerRepository.recordTransaction(
      {
        sourceType: 'CHARGEBACK',
        sourceId: orderId,
        description: `Chargeback recorded for order ${orderId}`,
        entries: [
          {
            accountId: sellerPayable.id,
            entryType: 'DEBIT',
            amount: chargebackAmount,
            currency,
            description: `CHARGEBACK: debit seller payable for order ${orderId}`,
          },
          {
            accountId: platformClearing.id,
            entryType: 'CREDIT',
            amount: chargebackAmount,
            currency,
            description: `CHARGEBACK: credit platform clearing for order ${orderId}`,
          },
        ],
      },
      tx,
    );

    // Decrement pending or available depending on whether the order has been settled.
    // Chargeback can drive the balance negative per D10.
    await this.adjustSellerBalanceForChargeback(orderId, organizationId, chargebackAmount, tx);

    this.logger.log(
      `Chargeback ledger entries recorded for orderId=${orderId}, amount=${chargebackAmount} ${currency}`,
    );
  }

  /**
   * If the order has been settled (balance_settlements row exists), decrement available.
   * Otherwise decrement pending — the funds never left the holding bucket.
   */
  private async adjustSellerBalanceForChargeback(
    orderId: string,
    organizationId: string,
    chargebackAmount: bigint,
    tx?: unknown,
  ): Promise<void> {
    const isSettled = await this.orderSettlementQuery.isOrderSettled(orderId, tx);

    if (isSettled) {
      await this.sellerBalanceRepo.decrementAvailable(organizationId, chargebackAmount, tx);
    } else {
      await this.sellerBalanceRepo.decrementPending(organizationId, chargebackAmount, tx);
    }
  }
}
