import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { ISettlementPolicyPort } from '../../domain/ports/settlement-policy.port';

@Injectable()
export class FeePolicySettlementAdapter implements ISettlementPolicyPort {
  constructor(private readonly prisma: PrismaService) {}

  async getDelayDays(organizationId: string): Promise<number> {
    // Prefer org-specific active policy, fallback to global
    const orgPolicy = await this.prisma.feePolicy.findFirst({
      where: { organizationId, isActive: true },
      select: { settlementDelayDays: true },
    });

    if (orgPolicy !== null) {
      return orgPolicy.settlementDelayDays;
    }

    const globalPolicy = await this.prisma.feePolicy.findFirst({
      where: { organizationId: null, isActive: true },
      select: { settlementDelayDays: true },
    });

    return globalPolicy?.settlementDelayDays ?? 7;
  }
}
