import {
  IPayoutGatewayPort,
} from '../../domain/ports/payout-gateway.port';
import {
  IPayoutRecipientRepository,
} from '../../domain/ports/payout-recipient.repository.port';
import { PayoutRecipient } from '../../domain/entities/payout-recipient.entity';

export class RegisterPayoutRecipientUseCase {
  constructor(
    private readonly payoutGateway: IPayoutGatewayPort,
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
