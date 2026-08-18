import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ILedgerRepository,
  LEDGER_REPOSITORY,
} from '../../domain/ports/ledger.repository.port';
import {
  SELLER_BALANCE_REPOSITORY,
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';

export interface RecordChargebackInput {
  orderId: string;
  organizationId: string;
  chargebackAmount: bigint;
  currency: string;
  tx?: unknown;
}

@Injectable()
export class RecordChargebackUseCase {
  private readonly logger = new Logger(RecordChargebackUseCase.name);

  constructor(
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepository: ILedgerRepository,
    @Inject(SELLER_BALANCE_REPOSITORY)
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
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

    // Update seller balance: available -= chargebackAmount (can go negative per D10)
    await this.sellerBalanceRepo.decrementAvailable(organizationId, chargebackAmount, tx);

    this.logger.log(
      `Chargeback ledger entries recorded for orderId=${orderId}, amount=${chargebackAmount} ${currency}`,
    );
  }
}
