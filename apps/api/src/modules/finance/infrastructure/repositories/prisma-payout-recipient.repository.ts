import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  IPayoutRecipientRepository,
} from '../../domain/ports/payout-recipient.repository.port';
import {
  PayoutRecipient,
  PayoutRecipientStatus,
} from '../../domain/entities/payout-recipient.entity';

interface RawPayoutRecipient {
  id: string;
  organization_id: string;
  provider: string;
  external_recipient_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function mapToEntity(raw: RawPayoutRecipient): PayoutRecipient {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    provider: raw.provider,
    externalRecipientId: raw.external_recipient_id,
    status: raw.status as PayoutRecipientStatus,
    metadata: raw.metadata,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

@Injectable()
export class PrismaPayoutRecipientRepository implements IPayoutRecipientRepository {
  private readonly logger = new Logger(PrismaPayoutRecipientRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByOrg(organizationId: string): Promise<PayoutRecipient | null> {
    const rows = await this.prisma.$queryRaw<RawPayoutRecipient[]>`
      SELECT id, organization_id, provider, external_recipient_id, status, metadata,
             created_at, updated_at
      FROM payout_recipients
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ? mapToEntity(rows[0]) : null;
  }

  async create(
    recipient: Omit<PayoutRecipient, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PayoutRecipient> {
    const rows = await this.prisma.$queryRaw<RawPayoutRecipient[]>`
      INSERT INTO payout_recipients (organization_id, provider, external_recipient_id, status, metadata)
      VALUES (
        ${recipient.organizationId}::uuid,
        ${recipient.provider},
        ${recipient.externalRecipientId},
        ${recipient.status},
        ${JSON.stringify(recipient.metadata)}::jsonb
      )
      RETURNING id, organization_id, provider, external_recipient_id, status, metadata,
                created_at, updated_at
    `;
    if (!rows[0]) {
      throw new Error('Failed to create payout recipient');
    }
    return mapToEntity(rows[0]);
  }

  async findOrCreate(
    organizationId: string,
    provider: string,
    externalRecipientId: string,
  ): Promise<PayoutRecipient> {
    // Atomic: INSERT ON CONFLICT DO NOTHING + SELECT
    await this.prisma.$executeRaw`
      INSERT INTO payout_recipients (organization_id, provider, external_recipient_id, status)
      VALUES (${organizationId}::uuid, ${provider}, ${externalRecipientId}, 'VERIFIED')
      ON CONFLICT (organization_id) DO NOTHING
    `;

    const rows = await this.prisma.$queryRaw<RawPayoutRecipient[]>`
      SELECT id, organization_id, provider, external_recipient_id, status, metadata,
             created_at, updated_at
      FROM payout_recipients
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;

    if (!rows[0]) {
      throw new Error(`Payout recipient not found after findOrCreate for org=${organizationId}`);
    }

    return mapToEntity(rows[0]);
  }

  async updateStatus(id: string, status: PayoutRecipientStatus): Promise<void> {
    const result = await this.prisma.$executeRaw`
      UPDATE payout_recipients
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    if (result === 0) {
      this.logger.warn(`updateStatus: no rows updated for payout_recipient id=${id}`);
    }
  }
}
