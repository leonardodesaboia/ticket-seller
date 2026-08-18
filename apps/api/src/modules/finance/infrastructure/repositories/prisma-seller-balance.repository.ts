import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { ISellerBalanceRepository } from '../../domain/ports/seller-balance.repository.port';
import { SellerBalance } from '../../domain/entities/seller-balance.entity';

type PrismaTransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

interface RawSellerBalance {
  id: string;
  organization_id: string;
  pending_amount: bigint;
  available_amount: bigint;
  reserved_amount: bigint;
  currency: string;
  version: number;
  updated_at: Date;
  created_at: Date;
}

function mapToEntity(raw: RawSellerBalance): SellerBalance {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    pendingAmount: raw.pending_amount,
    availableAmount: raw.available_amount,
    reservedAmount: raw.reserved_amount,
    currency: raw.currency,
    version: raw.version,
    updatedAt: raw.updated_at,
    createdAt: raw.created_at,
  };
}

@Injectable()
export class PrismaSellerBalanceRepository implements ISellerBalanceRepository {
  private readonly logger = new Logger(PrismaSellerBalanceRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: unknown): PrismaTransactionClient | PrismaService {
    return (tx as PrismaTransactionClient | undefined) ?? this.prisma;
  }

  async findByOrg(organizationId: string, tx?: unknown): Promise<SellerBalance | null> {
    const client = this.client(tx);
    const rows = await client.$queryRaw<RawSellerBalance[]>`
      SELECT id, organization_id, pending_amount, available_amount, reserved_amount,
             currency, version, updated_at, created_at
      FROM seller_balances
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ? mapToEntity(rows[0]) : null;
  }

  async findByOrgForUpdate(organizationId: string, tx?: unknown): Promise<SellerBalance | null> {
    const client = this.client(tx);
    const rows = await client.$queryRaw<RawSellerBalance[]>`
      SELECT id, organization_id, pending_amount, available_amount, reserved_amount,
             currency, version, updated_at, created_at
      FROM seller_balances
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
      FOR UPDATE
    `;
    return rows[0] ? mapToEntity(rows[0]) : null;
  }

  async upsertIncrementPending(
    organizationId: string,
    currency: string,
    amount: bigint,
    tx?: unknown,
  ): Promise<void> {
    const client = this.client(tx);
    await client.$executeRaw`
      INSERT INTO seller_balances (organization_id, currency, pending_amount, version, updated_at)
      VALUES (${organizationId}::uuid, ${currency}, ${amount}, 1, NOW())
      ON CONFLICT (organization_id) DO UPDATE
        SET pending_amount = seller_balances.pending_amount + EXCLUDED.pending_amount,
            version = seller_balances.version + 1,
            updated_at = NOW()
    `;
  }

  async decrementPendingIncrementAvailable(
    organizationId: string,
    amount: bigint,
    version: number,
    tx?: unknown,
  ): Promise<void> {
    const client = this.client(tx);
    const result = await client.$executeRaw`
      UPDATE seller_balances
      SET pending_amount = pending_amount - ${amount},
          available_amount = available_amount + ${amount},
          version = version + 1,
          updated_at = NOW()
      WHERE organization_id = ${organizationId}::uuid
        AND version = ${version}
    `;

    if (result === 0) {
      this.logger.warn(
        `decrementPendingIncrementAvailable: no rows updated for org=${organizationId} version=${version} — optimistic lock conflict or missing row`,
      );
    }
  }

  async decrementAvailable(organizationId: string, amount: bigint, tx?: unknown): Promise<void> {
    const client = this.client(tx);
    await client.$executeRaw`
      UPDATE seller_balances
      SET available_amount = available_amount - ${amount},
          version = version + 1,
          updated_at = NOW()
      WHERE organization_id = ${organizationId}::uuid
    `;
  }

  async decrementPending(organizationId: string, amount: bigint, tx?: unknown): Promise<void> {
    const client = this.client(tx);
    await client.$executeRaw`
      UPDATE seller_balances
      SET pending_amount = pending_amount - ${amount},
          version = version + 1,
          updated_at = NOW()
      WHERE organization_id = ${organizationId}::uuid
    `;
  }

  async incrementReserved(organizationId: string, amount: bigint, tx?: unknown): Promise<void> {
    const client = this.client(tx);
    await client.$executeRaw`
      UPDATE seller_balances
      SET reserved_amount = reserved_amount + ${amount},
          version = version + 1,
          updated_at = NOW()
      WHERE organization_id = ${organizationId}::uuid
    `;
  }

  async decrementReserved(organizationId: string, amount: bigint, tx?: unknown): Promise<void> {
    const client = this.client(tx);
    await client.$executeRaw`
      UPDATE seller_balances
      SET reserved_amount = reserved_amount - ${amount},
          version = version + 1,
          updated_at = NOW()
      WHERE organization_id = ${organizationId}::uuid
    `;
  }
}
