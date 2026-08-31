import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { ILogger } from '../../../../shared/kernel/logger.port';
import {
  IPayoutRepository,
} from '../../domain/ports/payout.repository.port';
import {
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import {
  ILedgerRepository,
} from '../../domain/ports/ledger.repository.port';
import {
  IPayoutGatewayPort,
} from '../../domain/ports/payout-gateway.port';
import { IFinanceTransactionRunner } from '../ports/finance-transaction-runner.port';

export interface ProcessPayoutWebhookInput {
  rawBody: Buffer;
  signature: string;
}

interface PayoutWebhookEventData {
  provider: string;
  providerEventId: string;
  payoutId: string;
  rawPayload: unknown;
}

export class ProcessPayoutWebhookUseCase {
  constructor(
    private readonly transactionRunner: IFinanceTransactionRunner,
    private readonly payoutRepo: IPayoutRepository,
    private readonly balanceRepo: ISellerBalanceRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly gateway: IPayoutGatewayPort,
    private readonly logger: ILogger,
  ) {}

  async execute(input: ProcessPayoutWebhookInput): Promise<void> {
    // Step 1: Parse and validate webhook signature — throws UnauthorizedException if invalid
    const event = this.gateway.parseWebhookEvent(input.rawBody, input.signature);

    const { provider, providerEventId, externalPayoutId, eventType, amount, currency, rawPayload } =
      event;

    // Step 2: Locate payout by external_payout_id
    const payout = await this.payoutRepo.findByExternalId(externalPayoutId);

    if (!payout) {
      this.logger.warn(
        `Payout webhook received for unknown externalPayoutId (redacted) — event ${providerEventId}`,
      );
      throw new NotFoundError('Payout not found for webhook event');
    }

    // Step 3: Guard — if already terminal, idempotent return
    if (payout.status === 'PAID' || payout.status === 'FAILED') {
      this.logger.log(
        `Payout ${payout.id} already in terminal status=${payout.status} — skipping`,
      );
      return;
    }

    // Step 4: Guard — reject webhook if amount/currency diverges from stored payout.
    // Currency comparison is case-sensitive; upstream normalization to uppercase (e.g. 'BRL')
    // is enforced by the gateway adapter in parseWebhookEvent.
    if (event.amount !== payout.amount || event.currency !== payout.currency) {
      await this.transactionRunner.run(async (tx) => {
        type TxRaw = { $executeRaw: (...args: unknown[]) => Promise<number> };
        const txRaw = tx as TxRaw;
        await txRaw.$executeRaw`
          INSERT INTO outbox_events (aggregate_type, aggregate_id, type, payload, organization_id)
          VALUES (
            'payout',
            ${payout.id}::uuid,
            'finance.webhook-mismatch.v1',
            ${JSON.stringify({
              payoutId: payout.id,
              organizationId: payout.organizationId,
              expectedAmount: payout.amount.toString(),
              actualAmount: event.amount.toString(),
              expectedCurrency: payout.currency,
              actualCurrency: event.currency,
              providerEventId,
            })}::jsonb,
            ${payout.organizationId}::uuid
          )
        `;
      });
      this.logger.warn(
        `Payout webhook mismatch for payout ${payout.id} — ` +
          `expected amount=${payout.amount} currency=${payout.currency}, ` +
          `got amount=${event.amount.toString()} currency=${event.currency} ` +
          `(event ${providerEventId}) — rejecting webhook`,
      );
      return;
    }

    // Dedup INSERT is performed inside each handler's transaction so that a
    // failed transaction rolls it back — preventing an unprocessed event from
    // being permanently blocked by a committed dedup row.
    const webhookEventData: PayoutWebhookEventData = {
      provider,
      providerEventId,
      payoutId: payout.id,
      rawPayload,
    };

    const { organizationId } = payout;

    if (eventType === 'SUCCEEDED') {
      await this.handleSucceeded(payout.id, organizationId, payout.amount, payout.currency, webhookEventData);
    } else {
      const failureReason = `Provider reported FAILED for event ${providerEventId}`;
      await this.handleFailed(payout.id, organizationId, payout.amount, payout.currency, failureReason, webhookEventData);
    }
  }

  private async handleSucceeded(
    payoutId: string,
    organizationId: string,
    amount: bigint,
    currency: string,
    webhookEvent: PayoutWebhookEventData,
  ): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      type TxRaw = { $executeRaw: (...args: unknown[]) => Promise<number>; $queryRaw: (...args: unknown[]) => Promise<Array<{ status: string }>> };
      const txRaw = tx as TxRaw;

      // Dedup inside transaction: if another concurrent request already processed this event,
      // the INSERT returns 0 rows and we exit, rolling back the transaction cleanly.
      const rowsAffected = await txRaw.$executeRaw`
        INSERT INTO payout_webhook_events (provider, provider_event_id, payout_id, raw_payload)
        VALUES (
          ${webhookEvent.provider},
          ${webhookEvent.providerEventId},
          ${webhookEvent.payoutId}::uuid,
          ${JSON.stringify(webhookEvent.rawPayload)}::jsonb
        )
        ON CONFLICT (provider, provider_event_id) DO NOTHING
      `;
      if (rowsAffected === 0) {
        this.logger.log(`Payout webhook ${webhookEvent.providerEventId} already processed — skipping`);
        return;
      }

      // Re-check status under lock: concurrent FAILED webhook may have already terminated this payout.
      const payoutRows = await txRaw.$queryRaw`
        SELECT status FROM payouts WHERE id = ${payoutId}::uuid FOR UPDATE
      `;
      const currentStatus = payoutRows[0]?.status;
      if (currentStatus === 'PAID' || currentStatus === 'FAILED') {
        this.logger.warn(`Payout ${payoutId} already terminal (${currentStatus}) — skipping SUCCEEDED handler`);
        return;
      }

      // Update payout → PAID
      await this.payoutRepo.updateStatus(
        payoutId,
        'PAID',
        { succeededAt: new Date() },
        tx,
      );

      // seller_balances.reserved -= amount
      await this.balanceRepo.decrementReserved(organizationId, amount, tx);

      // Ledger PAYOUT_SUCCEEDED:
      // DEBIT PAYOUT_CLEARING[org] — funds leave the platform clearing
      // CREDIT PLATFORM_CLEARING — funds arrived at the provider (settlement)
      const payoutClearing = await this.ledgerRepo.findOrCreateOrgAccount(
        `PAYOUT_CLEARING:${organizationId}`,
        'Payout Clearing',
        'LIABILITY',
        organizationId,
        currency,
        tx,
      );

      const platformClearing = await this.ledgerRepo.findAccountByCode('PLATFORM_CLEARING', tx);
      if (!platformClearing) {
        throw new Error('PLATFORM_CLEARING account not found — check seed migration');
      }

      await this.ledgerRepo.recordTransaction(
        {
          sourceType: 'PAYOUT_SUCCEEDED',
          sourceId: payoutId,
          description: `Payout succeeded for payout ${payoutId}`,
          entries: [
            {
              accountId: payoutClearing.id,
              entryType: 'DEBIT',
              amount,
              currency,
              description: `PAYOUT_SUCCEEDED: debit payout clearing for payout ${payoutId}`,
            },
            {
              accountId: platformClearing.id,
              entryType: 'CREDIT',
              amount,
              currency,
              description: `PAYOUT_SUCCEEDED: credit platform clearing for payout ${payoutId}`,
            },
          ],
        },
        tx,
      );
    });

    this.logger.log(`Payout ${payoutId} marked PAID, reserved -= ${amount} ${currency}`);
  }

  private async handleFailed(
    payoutId: string,
    organizationId: string,
    amount: bigint,
    currency: string,
    failureReason: string,
    webhookEvent: PayoutWebhookEventData,
  ): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      type TxRaw = { $executeRaw: (...args: unknown[]) => Promise<number>; $queryRaw: (...args: unknown[]) => Promise<Array<{ status: string }>> };
      const txRaw = tx as TxRaw;

      const rowsAffected = await txRaw.$executeRaw`
        INSERT INTO payout_webhook_events (provider, provider_event_id, payout_id, raw_payload)
        VALUES (
          ${webhookEvent.provider},
          ${webhookEvent.providerEventId},
          ${webhookEvent.payoutId}::uuid,
          ${JSON.stringify(webhookEvent.rawPayload)}::jsonb
        )
        ON CONFLICT (provider, provider_event_id) DO NOTHING
      `;
      if (rowsAffected === 0) {
        this.logger.log(`Payout webhook ${webhookEvent.providerEventId} already processed — skipping`);
        return;
      }

      // Re-check status under lock: concurrent SUCCEEDED webhook may have already terminated this payout.
      const payoutRows = await txRaw.$queryRaw`
        SELECT status FROM payouts WHERE id = ${payoutId}::uuid FOR UPDATE
      `;
      const currentStatus = payoutRows[0]?.status;
      if (currentStatus === 'PAID' || currentStatus === 'FAILED') {
        this.logger.warn(`Payout ${payoutId} already terminal (${currentStatus}) — skipping FAILED handler`);
        return;
      }

      // Update payout → FAILED
      await this.payoutRepo.updateStatus(
        payoutId,
        'FAILED',
        { failedAt: new Date(), failureReason },
        tx,
      );

      // seller_balances.reserved -= amount, available += amount (restore)
      await this.balanceRepo.decrementReserved(organizationId, amount, tx);
      await txRaw.$executeRaw`
        UPDATE seller_balances
        SET available_amount = available_amount + ${amount},
            version          = version + 1,
            updated_at       = NOW()
        WHERE organization_id = ${organizationId}::uuid
      `;

      // Ledger PAYOUT_FAILED (reversal):
      // DEBIT PAYOUT_CLEARING[org] — cancel the transit
      // CREDIT SELLER_PAYABLE[org] — restore platform's obligation to the seller
      const payoutClearing = await this.ledgerRepo.findOrCreateOrgAccount(
        `PAYOUT_CLEARING:${organizationId}`,
        'Payout Clearing',
        'LIABILITY',
        organizationId,
        currency,
        tx,
      );

      const sellerPayable = await this.ledgerRepo.findOrCreateOrgAccount(
        `SELLER_PAYABLE:${organizationId}`,
        'Seller Payable',
        'LIABILITY',
        organizationId,
        currency,
        tx,
      );

      await this.ledgerRepo.recordTransaction(
        {
          sourceType: 'PAYOUT_FAILED',
          sourceId: payoutId,
          description: `Payout failed for payout ${payoutId}`,
          entries: [
            {
              accountId: payoutClearing.id,
              entryType: 'DEBIT',
              amount,
              currency,
              description: `PAYOUT_FAILED: debit payout clearing for payout ${payoutId}`,
            },
            {
              accountId: sellerPayable.id,
              entryType: 'CREDIT',
              amount,
              currency,
              description: `PAYOUT_FAILED: credit seller payable (reversal) for payout ${payoutId}`,
            },
          ],
        },
        tx,
      );
    });

    this.logger.log(`Payout ${payoutId} marked FAILED, balance restored`);
  }
}
