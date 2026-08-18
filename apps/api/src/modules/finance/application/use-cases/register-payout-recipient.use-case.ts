import { Inject, Injectable } from '@nestjs/common';
import {
  PAYOUT_GATEWAY_PORT,
  IPayoutGatewayPort,
} from '../../domain/ports/payout-gateway.port';
import {
  PAYOUT_RECIPIENT_REPOSITORY,
  IPayoutRecipientRepository,
} from '../../domain/ports/payout-recipient.repository.port';
import { PayoutRecipient } from '../../domain/entities/payout-recipient.entity';

@Injectable()
export class RegisterPayoutRecipientUseCase {
  constructor(
    @Inject(PAYOUT_GATEWAY_PORT)
    private readonly payoutGateway: IPayoutGatewayPort,
    @Inject(PAYOUT_RECIPIENT_REPOSITORY)
    private readonly payoutRecipientRepo: IPayoutRecipientRepository,
  ) {}

  async execute(organizationId: string): Promise<PayoutRecipient> {
    // Idempotent: return existing recipient if already registered
    const existing = await this.payoutRecipientRepo.findByOrg(organizationId);
    if (existing) {
      return existing;
    }

    // Call gateway to create a recipient
    const gatewayResult = await this.payoutGateway.createRecipient({ organizationId });

    // Persist atomically (ON CONFLICT DO NOTHING + SELECT)
    const recipient = await this.payoutRecipientRepo.findOrCreate(
      organizationId,
      this.payoutGateway.provider,
      gatewayResult.externalRecipientId,
    );

    return recipient;
  }
}
