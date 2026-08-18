import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IOrderPricingSnapshotRepository,
  ORDER_PRICING_SNAPSHOT_REPOSITORY,
} from '../../domain/ports/order-pricing-snapshot.repository.port';
import {
  ILedgerRepository,
  LEDGER_REPOSITORY,
} from '../../domain/ports/ledger.repository.port';
import {
  SELLER_BALANCE_REPOSITORY,
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface RecordRefundInput {
  orderId: string;
  organizationId: string;
  refundAmount: bigint;
  currency: string;
  tx?: unknown;
}

@Injectable()
export class RecordRefundUseCase {
  private readonly logger = new Logger(RecordRefundUseCase.name);

  constructor(
    @Inject(ORDER_PRICING_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: IOrderPricingSnapshotRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepository: ILedgerRepository,
    @Inject(SELLER_BALANCE_REPOSITORY)
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: RecordRefundInput): Promise<void> {
    const { orderId, organizationId, refundAmount, currency, tx } = input;

    // 1. Load pricing snapshot to know fee amounts and refund_fee_policy
    const snapshot = await this.snapshotRepository.findByOrderId(orderId);
    if (!snapshot) {
      this.logger.warn(
        `No pricing snapshot found for orderId=${orderId} — skipping ledger entries for refund`,
      );
      return;
    }

    // 2. Resolve platform accounts
    const platformClearing = await this.ledgerRepository.findAccountByCode(
      'PLATFORM_CLEARING',
      tx,
    );
    if (!platformClearing) {
      throw new Error('PLATFORM_CLEARING account not found — check seed migration');
    }

    // 3. Find or create org-scoped SELLER_PAYABLE account
    const sellerPayable = await this.ledgerRepository.findOrCreateOrgAccount(
      `SELLER_PAYABLE:${organizationId}`,
      'Seller Payable',
      'LIABILITY',
      organizationId,
      currency,
      tx,
    );

    // 4. Calculate entries according to refund_fee_policy
    type EntryInput = {
      accountId: string;
      entryType: 'DEBIT' | 'CREDIT';
      amount: bigint;
      currency: string;
      description?: string;
    };

    const entries: EntryInput[] = [];
    const effectivePolicy = snapshot.refundFeePolicy === 'TBD' ? 'RETAIN' : snapshot.refundFeePolicy;

    if (effectivePolicy === 'RETAIN') {
      // Producer bears the platform fee: refund sellerNetAmount only
      // DEBIT SELLER_PAYABLE = sellerNetAmount, CREDIT PLATFORM_CLEARING = sellerNetAmount
      if (snapshot.sellerNetAmount > 0n) {
        entries.push({
          accountId: sellerPayable.id,
          entryType: 'DEBIT',
          amount: snapshot.sellerNetAmount,
          currency,
          description: `REFUND (RETAIN): seller net reversal for order ${orderId}`,
        });
        entries.push({
          accountId: platformClearing.id,
          entryType: 'CREDIT',
          amount: snapshot.sellerNetAmount,
          currency,
          description: `REFUND (RETAIN): clearing reduction for order ${orderId}`,
        });
      }
    } else if (effectivePolicy === 'REFUND') {
      // Platform refunds fee too: gross reversal
      // DEBIT SELLER_PAYABLE = grossAmount
      // CREDIT PLATFORM_CLEARING = sellerNetAmount
      // CREDIT PLATFORM_REVENUE = platformFeeAmount (if > 0)
      if (snapshot.grossAmount > 0n) {
        entries.push({
          accountId: sellerPayable.id,
          entryType: 'DEBIT',
          amount: snapshot.grossAmount,
          currency,
          description: `REFUND (REFUND): full gross reversal for order ${orderId}`,
        });
        entries.push({
          accountId: platformClearing.id,
          entryType: 'CREDIT',
          amount: snapshot.sellerNetAmount,
          currency,
          description: `REFUND (REFUND): clearing reduction for order ${orderId}`,
        });
        if (snapshot.platformFeeAmount > 0n) {
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
            amount: snapshot.platformFeeAmount,
            currency,
            description: `REFUND (REFUND): platform fee reversal for order ${orderId}`,
          });
        }
      }
    } else if (effectivePolicy === 'PROPORTIONAL') {
      // Proportional: scale sellerNetAmount and platformFeeAmount by refundAmount/grossAmount
      // to avoid float, use bigint arithmetic: scaled = amount * refundAmount / grossAmount
      const gross = snapshot.grossAmount;
      if (gross > 0n && refundAmount > 0n) {
        const scaledSellerNet = (snapshot.sellerNetAmount * refundAmount) / gross;
        const scaledPlatformFee = (snapshot.platformFeeAmount * refundAmount) / gross;
        // Total DEBIT = scaledSellerNet + scaledPlatformFee (may differ from refundAmount due to floor)
        const totalDebit = scaledSellerNet + scaledPlatformFee;

        if (totalDebit > 0n) {
          entries.push({
            accountId: sellerPayable.id,
            entryType: 'DEBIT',
            amount: totalDebit,
            currency,
            description: `REFUND (PROPORTIONAL): proportional reversal for order ${orderId}`,
          });
          if (scaledSellerNet > 0n) {
            entries.push({
              accountId: platformClearing.id,
              entryType: 'CREDIT',
              amount: scaledSellerNet,
              currency,
              description: `REFUND (PROPORTIONAL): clearing reduction for order ${orderId}`,
            });
          }
          if (scaledPlatformFee > 0n) {
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
              amount: scaledPlatformFee,
              currency,
              description: `REFUND (PROPORTIONAL): platform fee reversal for order ${orderId}`,
            });
          }
        }
      }
    }

    if (entries.length === 0) {
      this.logger.warn(
        `No ledger entries to record for REFUND of order ${orderId} (policy=${snapshot.refundFeePolicy}, amounts may be zero)`,
      );
      return;
    }

    await this.ledgerRepository.recordTransaction(
      {
        sourceType: 'REFUND',
        sourceId: orderId,
        description: `Refund recorded for order ${orderId} (policy=${snapshot.refundFeePolicy})`,
        entries,
      },
      tx,
    );

    // Update seller balance: reduce pending or available depending on settlement state
    await this.adjustSellerBalanceForRefund(orderId, organizationId, snapshot.sellerNetAmount, tx);

    this.logger.log(
      `Refund ledger entries recorded for orderId=${orderId}, policy=${snapshot.refundFeePolicy}`,
    );
  }

  /**
   * Checks if a balance_settlement exists for this order.
   * - If settled: available -= sellerNetAmount (can go negative per D10).
   * - If not settled: pending -= sellerNetAmount.
   */
  private async adjustSellerBalanceForRefund(
    orderId: string,
    organizationId: string,
    sellerNetAmount: bigint,
    tx?: unknown,
  ): Promise<void> {
    if (sellerNetAmount <= 0n) {
      return;
    }

    type TxClient = { $queryRaw: PrismaService['$queryRaw'] };
    const client: TxClient = (tx as TxClient | undefined) ?? this.prisma;
    const rows = await client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM balance_settlements
      WHERE order_id = ${orderId}::uuid
    `;
    const isSettled = Number(rows[0]?.count ?? 0n) > 0;

    if (isSettled) {
      await this.sellerBalanceRepo.decrementAvailable(organizationId, sellerNetAmount, tx);
    } else {
      await this.sellerBalanceRepo.decrementPending(organizationId, sellerNetAmount, tx);
    }
  }
}
