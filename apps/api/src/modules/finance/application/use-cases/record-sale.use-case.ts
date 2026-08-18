import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FEE_POLICY_REPOSITORY,
  IFeePolicyRepository,
} from '../../domain/ports/fee-policy.repository.port';
import {
  IOrderPricingSnapshotRepository,
  ORDER_PRICING_SNAPSHOT_REPOSITORY,
} from '../../domain/ports/order-pricing-snapshot.repository.port';
import {
  ILedgerRepository,
  LEDGER_REPOSITORY,
} from '../../domain/ports/ledger.repository.port';
import { OrderPricingSnapshot } from '../../domain/entities/order-pricing-snapshot.entity';
import { CalculateOrderPricingUseCase } from './calculate-order-pricing.use-case';

export interface RecordSaleInput {
  orderId: string;
  organizationId: string;
  grossAmount: bigint;
  currency: string;
  tx?: unknown;
}

@Injectable()
export class RecordSaleUseCase {
  private readonly logger = new Logger(RecordSaleUseCase.name);

  constructor(
    @Inject(FEE_POLICY_REPOSITORY)
    private readonly feePolicyRepository: IFeePolicyRepository,
    @Inject(ORDER_PRICING_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: IOrderPricingSnapshotRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepository: ILedgerRepository,
    private readonly calculateOrderPricing: CalculateOrderPricingUseCase,
  ) {}

  async execute(input: RecordSaleInput): Promise<void> {
    const { orderId, organizationId, grossAmount, currency, tx } = input;

    // Resolve active fee policy: org-specific first, then global fallback
    const policy =
      (await this.feePolicyRepository.findActive(organizationId)) ??
      (await this.feePolicyRepository.findActive());

    if (!policy) {
      throw new Error(
        `No active fee policy found for organizationId=${organizationId} and no global policy exists`,
      );
    }

    const { feeCalculation } = this.calculateOrderPricing.execute({
      grossAmount,
      currency,
      policy,
    });

    const snapshot: OrderPricingSnapshot = {
      orderId,
      feePolicyId: policy.id,
      grossAmount,
      currency,
      platformFeeBps: feeCalculation.platformFeeBps,
      platformFeeAmount: feeCalculation.platformFeeAmount,
      processingFeeBps: feeCalculation.processingFeeBps,
      processingFeeAmount: feeCalculation.processingFeeAmount,
      refundFeePolicy: policy.refundFeePolicy,
      sellerNetAmount: feeCalculation.sellerNetAmount,
      createdAt: new Date(),
    };

    await this.snapshotRepository.create(snapshot, tx);

    // Record double-entry ledger transaction for ORDER_PAID
    await this.recordLedgerEntries({
      orderId,
      organizationId,
      grossAmount,
      sellerNetAmount: feeCalculation.sellerNetAmount,
      platformFeeAmount: feeCalculation.platformFeeAmount,
      currency,
      tx,
    });

    this.logger.log(
      `Pricing snapshot created for orderId=${orderId}: ` +
        `gross=${grossAmount} ${currency}, ` +
        `platformFee=${feeCalculation.platformFeeAmount} (${feeCalculation.platformFeeBps} bps), ` +
        `sellerNet=${feeCalculation.sellerNetAmount}`,
    );
  }

  private async recordLedgerEntries(params: {
    orderId: string;
    organizationId: string;
    grossAmount: bigint;
    sellerNetAmount: bigint;
    platformFeeAmount: bigint;
    currency: string;
    tx?: unknown;
  }): Promise<void> {
    const {
      orderId,
      organizationId,
      grossAmount,
      sellerNetAmount,
      platformFeeAmount,
      currency,
      tx,
    } = params;

    // Resolve platform accounts
    const platformClearing = await this.ledgerRepository.findAccountByCode(
      'PLATFORM_CLEARING',
      tx,
    );
    if (!platformClearing) {
      throw new Error('PLATFORM_CLEARING account not found — check seed migration');
    }

    // Find or create org-scoped SELLER_PAYABLE account
    const sellerPayable = await this.ledgerRepository.findOrCreateOrgAccount(
      `SELLER_PAYABLE:${organizationId}`,
      'Seller Payable',
      'LIABILITY',
      organizationId,
      currency,
      tx,
    );

    // Build entries: always DEBIT PLATFORM_CLEARING + CREDIT SELLER_PAYABLE
    type EntryInput = {
      accountId: string;
      entryType: 'DEBIT' | 'CREDIT';
      amount: bigint;
      currency: string;
      description?: string;
    };

    const entries: EntryInput[] = [
      {
        accountId: platformClearing.id,
        entryType: 'DEBIT',
        amount: grossAmount,
        currency,
        description: `ORDER_PAID: gross amount for order ${orderId}`,
      },
      {
        accountId: sellerPayable.id,
        entryType: 'CREDIT',
        amount: sellerNetAmount,
        currency,
        description: `ORDER_PAID: seller net for order ${orderId}`,
      },
    ];

    // Only add PLATFORM_REVENUE credit if there is a non-zero platform fee
    if (platformFeeAmount > 0n) {
      const platformRevenue = await this.ledgerRepository.findAccountByCode(
        'PLATFORM_REVENUE',
        tx,
      );
      if (!platformRevenue) {
        throw new Error('PLATFORM_REVENUE account not found — check seed migration');
      }
      entries.push({
        accountId: platformRevenue.id,
        entryType: 'CREDIT',
        amount: platformFeeAmount,
        currency,
        description: `ORDER_PAID: platform fee for order ${orderId}`,
      });
    }

    await this.ledgerRepository.recordTransaction(
      {
        sourceType: 'ORDER_PAID',
        sourceId: orderId,
        description: `Sale recorded for order ${orderId}`,
        entries,
      },
      tx,
    );
  }
}
