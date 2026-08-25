import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PAYOUT_REPOSITORY,
  IPayoutRepository,
} from '../../domain/ports/payout.repository.port';
import {
  SELLER_BALANCE_REPOSITORY,
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import {
  LEDGER_REPOSITORY,
  ILedgerRepository,
} from '../../domain/ports/ledger.repository.port';
import {
  PAYOUT_GATEWAY_PORT,
  IPayoutGatewayPort,
} from '../../domain/ports/payout-gateway.port';

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

@Injectable()
export class ProcessPayoutWebhookUseCase {
  private readonly logger = new Logger(ProcessPayoutWebhookUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYOUT_REPOSITORY)
    private readonly payoutRepo: IPayoutRepository,
    @Inject(SELLER_BALANCE_REPOSITORY)
    private readonly balanceRepo: ISellerBalanceRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepo: ILedgerRepository,
    @Inject(PAYOUT_GATEWAY_PORT)
    private readonly gateway: IPayoutGatewayPort,
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
      throw new NotFoundException({
        message: 'Payout not found for webhook event',
        code: 'PAYOUT_NOT_FOUND',
      });
    }

    // Step 3: Guard — if already terminal, idempotent return
    if (payout.status === 'PAID' || payout.status === 'FAILED') {
      this.logger.log(
        `Payout ${payout.id} already in terminal status=${payout.status} — skipping`,
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
      await this.handleSucceeded(payout.id, organizationId, amount, currency, webhookEventData);
    } else {
      const failureReason = `Provider reported FAILED for event ${providerEventId}`;
      await this.handleFailed(payout.id, organizationId, amount, currency, failureReason, webhookEventData);
    }
  }

  private async handleSucceeded(
    payoutId: string,
    organizationId: string,
    amount: bigint,
    currency: string,
    webhookEvent: PayoutWebhookEventData,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Dedup inside transaction: if another concurrent request already processed this event,
      // the INSERT returns 0 rows and we exit, rolling back the transaction cleanly.
      const rowsAffected = await tx.$executeRaw`
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
    await this.prisma.$transaction(async (tx) => {
      const rowsAffected = await tx.$executeRaw`
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

      // Update payout → FAILED
      await this.payoutRepo.updateStatus(
        payoutId,
        'FAILED',
        { failedAt: new Date(), failureReason },
        tx,
      );

      // seller_balances.reserved -= amount, available += amount (restore)
      await this.balanceRepo.decrementReserved(organizationId, amount, tx);
      await tx.$executeRaw`
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
