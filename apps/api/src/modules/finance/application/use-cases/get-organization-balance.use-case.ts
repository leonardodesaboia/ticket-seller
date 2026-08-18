import { Inject, Injectable } from '@nestjs/common';
import {
  SELLER_BALANCE_REPOSITORY,
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';

export interface OrganizationBalanceResult {
  pendingAmount: bigint;
  availableAmount: bigint;
  reservedAmount: bigint;
  currency: string;
}

@Injectable()
export class GetOrganizationBalanceUseCase {
  constructor(
    @Inject(SELLER_BALANCE_REPOSITORY)
    private readonly sellerBalanceRepo: ISellerBalanceRepository,
  ) {}

  async execute(organizationId: string): Promise<OrganizationBalanceResult> {
    const balance = await this.sellerBalanceRepo.findByOrg(organizationId);

    if (!balance) {
      // No balance record yet — return zeroes with default currency
      return {
        pendingAmount: 0n,
        availableAmount: 0n,
        reservedAmount: 0n,
        currency: 'BRL',
      };
    }

    return {
      pendingAmount: balance.pendingAmount,
      availableAmount: balance.availableAmount,
      reservedAmount: balance.reservedAmount,
      currency: balance.currency,
    };
  }
}
