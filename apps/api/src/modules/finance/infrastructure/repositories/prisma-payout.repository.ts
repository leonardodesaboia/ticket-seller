import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IPayoutRepository } from '../../domain/ports/payout.repository.port';
import { Payout, PayoutStatus } from '../../domain/entities/payout.entity';

type PrismaTransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

interface RawPayout {
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

function mapToEntity(raw: RawPayout): Payout {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    recipientId: raw.recipient_id,
    amount: raw.amount,
    currency: raw.currency,
    status: raw.status as PayoutStatus,
    provider: raw.provider,
    externalPayoutId: raw.external_payout_id,
    idempotencyKey: raw.idempotency_key,
    failureReason: raw.failure_reason,
    requestedAt: raw.requested_at,
    succeededAt: raw.succeeded_at,
    failedAt: raw.failed_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

@Injectable()
export class PrismaPayoutRepository implements IPayoutRepository {
  private readonly logger = new Logger(PrismaPayoutRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: unknown): PrismaTransactionClient | PrismaService {
    return (tx as PrismaTransactionClient | undefined) ?? this.prisma;
  }

  /**
   * Creates a payout using INSERT ON CONFLICT (organization_id, idempotency_key) DO NOTHING.
   * Returns { payout, inserted: true } if newly created, or { payout, inserted: false } if already existed.
   */
  async create(
    data: Omit<Payout, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: unknown,
  ): Promise<{ payout: Payout; inserted: boolean }> {
    const client = this.client(tx);

    const rowsAffected = await client.$executeRaw`
      INSERT INTO payouts (
        organization_id, recipient_id, amount, currency, status, provider,
        external_payout_id, idempotency_key, failure_reason,
        requested_at, succeeded_at, failed_at
      )
      VALUES (
        ${data.organizationId}::uuid,
        ${data.recipientId}::uuid,
        ${data.amount},
        ${data.currency},
        ${data.status},
        ${data.provider},
        ${data.externalPayoutId ?? null},
        ${data.idempotencyKey},
        ${data.failureReason ?? null},
        ${data.requestedAt},
        ${data.succeededAt ?? null},
        ${data.failedAt ?? null}
      )
      ON CONFLICT (organization_id, idempotency_key) DO NOTHING
    `;

    const existing = await this.findByIdempotencyKey(
      data.organizationId,
      data.idempotencyKey,
      tx,
    );
    if (!existing) {
      throw new Error(
        `Failed to create or find payout with idempotency_key=${data.idempotencyKey}`,
      );
    }
    return { payout: existing, inserted: rowsAffected === 1 };
  }

  async findByIdempotencyKey(
    organizationId: string,
    key: string,
    tx?: unknown,
  ): Promise<Payout | null> {
    const client = this.client(tx);
    const rows = await client.$queryRaw<RawPayout[]>`
      SELECT id, organization_id, recipient_id, amount, currency, status, provider,
             external_payout_id, idempotency_key, failure_reason,
             requested_at, succeeded_at, failed_at, created_at, updated_at
      FROM payouts
      WHERE organization_id = ${organizationId}::uuid
        AND idempotency_key = ${key}
      LIMIT 1
    `;
    return rows[0] ? mapToEntity(rows[0]) : null;
  }

  async findByExternalId(externalPayoutId: string, tx?: unknown): Promise<Payout | null> {
    const client = this.client(tx);
    const rows = await client.$queryRaw<RawPayout[]>`
      SELECT id, organization_id, recipient_id, amount, currency, status, provider,
             external_payout_id, idempotency_key, failure_reason,
             requested_at, succeeded_at, failed_at, created_at, updated_at
      FROM payouts
      WHERE external_payout_id = ${externalPayoutId}
      LIMIT 1
    `;
    return rows[0] ? mapToEntity(rows[0]) : null;
  }

  async findProcessingOlderThan(minutes: number): Promise<Payout[]> {
    const rows = await this.prisma.$queryRaw<RawPayout[]>`
      SELECT id, organization_id, recipient_id, amount, currency, status, provider,
             external_payout_id, idempotency_key, failure_reason,
             requested_at, succeeded_at, failed_at, created_at, updated_at
      FROM payouts
      WHERE status = 'PROCESSING'
        AND requested_at < NOW() - (${minutes} * INTERVAL '1 minute')
    `;
    return rows.map(mapToEntity);
  }

  async updateStatus(
    id: string,
    status: PayoutStatus,
    extra?: Partial<
      Pick<Payout, 'externalPayoutId' | 'failureReason' | 'succeededAt' | 'failedAt'>
    >,
    tx?: unknown,
  ): Promise<void> {
    const client = this.client(tx);
    const externalPayoutId = extra?.externalPayoutId ?? null;
    const failureReason = extra?.failureReason ?? null;
    const succeededAt = extra?.succeededAt ?? null;
    const failedAt = extra?.failedAt ?? null;

    const result = await client.$executeRaw`
      UPDATE payouts
      SET status           = ${status},
          external_payout_id = COALESCE(${externalPayoutId}, external_payout_id),
          failure_reason   = COALESCE(${failureReason}, failure_reason),
          succeeded_at     = COALESCE(${succeededAt}::timestamptz, succeeded_at),
          failed_at        = COALESCE(${failedAt}::timestamptz, failed_at),
          updated_at       = NOW()
      WHERE id = ${id}::uuid
    `;

    if (result === 0) {
      this.logger.warn(`updateStatus: no rows updated for payout id=${id}`);
    }
  }

  async updateExternalId(
    id: string,
    externalPayoutId: string,
    status: PayoutStatus,
    tx?: unknown,
  ): Promise<void> {
    const client = this.client(tx);
    const result = await client.$executeRaw`
      UPDATE payouts
      SET external_payout_id = ${externalPayoutId},
          status             = ${status},
          updated_at         = NOW()
      WHERE id = ${id}::uuid
    `;

    if (result === 0) {
      this.logger.warn(`updateExternalId: no rows updated for payout id=${id}`);
    }
  }
}
