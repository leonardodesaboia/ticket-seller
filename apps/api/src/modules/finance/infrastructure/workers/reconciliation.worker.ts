import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { PrismaClient } from '@prisma/client';
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
import { Payout } from '../../domain/entities/payout.entity';
import { PG_BOSS } from '../../../../platform/scheduling/pgboss.module';

type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

@Injectable()
export class ReconciliationWorker implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationWorker.name);
  private readonly stuckMinutes = 30;
  static readonly JOB_NAME = 'reconciliation-poll';

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
    @Inject(PG_BOSS) private readonly boss: PgBoss,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.createQueue(ReconciliationWorker.JOB_NAME);
    await this.boss.schedule(ReconciliationWorker.JOB_NAME, '*/15 * * * *', {}, { tz: 'UTC' });
    await this.boss.work(ReconciliationWorker.JOB_NAME, () => this.poll());
    this.logger.log('ReconciliationWorker registered — cron */15 * * * * UTC (15min)');
  }

  private async poll(): Promise<void> {
    this.logger.log('ReconciliationWorker poll started');
    try {
      const payouts = await this.fetchStuckPayouts();
      if (payouts.length === 0) return;

      this.logger.log(`ReconciliationWorker: found ${payouts.length} stuck payout(s)`);
      for (const payout of payouts) {
        await this.reconcilePayout(payout);
      }
    } catch (err) {
      this.logger.error('ReconciliationWorker poll error', err);
      throw err;
    }
  }

  private async fetchStuckPayouts(): Promise<Payout[]> {
    interface RawRow {
      id: string;
      organization_id: string;
      recipient_id: string;
      amount: bigint;
      currency: string;
      status: string;
      provider: string;
      external_payout_id: string | null;
      idempotency_key: string;
      failure_reason: string | null;
      requested_at: Date;
      succeeded_at: Date | null;
      failed_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }

    const client = this.prisma as unknown as PrismaClient;
    const rows = await client.$transaction((tx) =>
      tx.$queryRaw<RawRow[]>`
        SELECT id, organization_id, recipient_id, amount, currency, status, provider,
               external_payout_id, idempotency_key, failure_reason,
               requested_at, succeeded_at, failed_at, created_at, updated_at
        FROM payouts
        WHERE status = 'PROCESSING'
          AND requested_at < NOW() - (${this.stuckMinutes} * INTERVAL '1 minute')
        ORDER BY requested_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      recipientId: row.recipient_id,
      amount: row.amount,
      currency: row.currency,
      status: row.status as Payout['status'],
      provider: row.provider,
      externalPayoutId: row.external_payout_id,
      idempotencyKey: row.idempotency_key,
      failureReason: row.failure_reason,
      requestedAt: row.requested_at,
      succeededAt: row.succeeded_at,
      failedAt: row.failed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async reconcilePayout(payout: Payout): Promise<void> {
    if (!payout.externalPayoutId) {
      this.logger.warn(
        `ReconciliationWorker: payout ${payout.id} has no externalPayoutId — skipping`,
      );
      return;
    }

    try {
      const gatewayStatus = await this.gateway.getPayoutStatus(payout.externalPayoutId);

      if (gatewayStatus.status === 'PROCESSING') return;

      const hasMismatch =
        gatewayStatus.amount !== undefined &&
        (gatewayStatus.amount !== payout.amount ||
          (gatewayStatus.currency !== undefined && gatewayStatus.currency !== payout.currency));

      if (hasMismatch) {
        const client = this.prisma as unknown as PrismaClient;
        await client.$executeRaw`
          INSERT INTO outbox_events (aggregate_type, aggregate_id, type, payload, organization_id)
          VALUES (
            'payout',
            ${payout.id}::uuid,
            'finance.reconciliation-mismatch.v1',
            ${JSON.stringify({
              payoutId: payout.id,
              organizationId: payout.organizationId,
              expectedAmount: payout.amount.toString(),
              actualAmount: gatewayStatus.amount?.toString() ?? null,
              expectedCurrency: payout.currency,
              actualCurrency: gatewayStatus.currency ?? null,
              gatewayStatus: gatewayStatus.status,
              reconciledAt: new Date().toISOString(),
            })}::jsonb,
            ${payout.organizationId}::uuid
          )
        `;

        this.logger.warn(
          `ReconciliationWorker: reconciliation mismatch for payout ${payout.id} — ` +
            `expected amount=${payout.amount} currency=${payout.currency}, ` +
            `got amount=${gatewayStatus.amount?.toString() ?? 'unknown'} currency=${gatewayStatus.currency ?? 'unknown'}`,
        );
      }

      if (gatewayStatus.status === 'PAID') {
        await this.handleSucceeded(payout);
      } else if (gatewayStatus.status === 'FAILED') {
        await this.handleFailed(payout);
      }
    } catch (err) {
      this.logger.error(
        `ReconciliationWorker: failed to reconcile payout ${payout.id}`,
        err,
      );
    }
  }

  private async handleSucceeded(payout: Payout): Promise<void> {
    const { id: payoutId, organizationId, amount, currency } = payout;
    const prismaClient = this.prisma as unknown as PrismaClient;

    await prismaClient.$transaction(async (tx: PrismaTransactionClient) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM payouts WHERE id = ${payoutId}::uuid FOR UPDATE
      `;
      const currentStatus = rows[0]?.status;
      if (currentStatus === 'PAID' || currentStatus === 'FAILED') {
        this.logger.warn(
          `ReconciliationWorker: payout ${payoutId} already terminal (${currentStatus}) — skipping SUCCEEDED handler`,
        );
        return;
      }

      await this.payoutRepo.updateStatus(payoutId, 'PAID', { succeededAt: new Date() }, tx);
      await this.balanceRepo.decrementReserved(organizationId, amount, tx);

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
          description: `Payout succeeded (reconciled) for payout ${payoutId}`,
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

    this.logger.log(`ReconciliationWorker: payout ${payoutId} reconciled as PAID`);
  }

  private async handleFailed(payout: Payout): Promise<void> {
    const { id: payoutId, organizationId, amount, currency } = payout;
    const prismaClient = this.prisma as unknown as PrismaClient;

    await prismaClient.$transaction(async (tx: PrismaTransactionClient) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM payouts WHERE id = ${payoutId}::uuid FOR UPDATE
      `;
      const currentStatus = rows[0]?.status;
      if (currentStatus === 'PAID' || currentStatus === 'FAILED') {
        this.logger.warn(
          `ReconciliationWorker: payout ${payoutId} already terminal (${currentStatus}) — skipping FAILED handler`,
        );
        return;
      }

      await this.payoutRepo.updateStatus(
        payoutId,
        'FAILED',
        { failedAt: new Date(), failureReason: 'Reconciliation: gateway reported FAILED' },
        tx,
      );

      await this.balanceRepo.decrementReserved(organizationId, amount, tx);
      await tx.$executeRaw`
        UPDATE seller_balances
        SET available_amount = available_amount + ${amount},
            version          = version + 1,
            updated_at       = NOW()
        WHERE organization_id = ${organizationId}::uuid
      `;

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
          description: `Payout failed (reconciled) for payout ${payoutId}`,
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

    this.logger.log(
      `ReconciliationWorker: payout ${payoutId} reconciled as FAILED, balance restored`,
    );
  }
}
