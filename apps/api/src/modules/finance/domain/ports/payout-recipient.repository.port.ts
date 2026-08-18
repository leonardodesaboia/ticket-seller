import { PayoutRecipient, PayoutRecipientStatus } from '../entities/payout-recipient.entity';

export const PAYOUT_RECIPIENT_REPOSITORY = Symbol('PAYOUT_RECIPIENT_REPOSITORY');

export interface IPayoutRecipientRepository {
  findByOrg(organizationId: string): Promise<PayoutRecipient | null>;
  create(
    recipient: Omit<PayoutRecipient, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PayoutRecipient>;
  findOrCreate(
    organizationId: string,
    provider: string,
    externalRecipientId: string,
  ): Promise<PayoutRecipient>;
  updateStatus(id: string, status: PayoutRecipientStatus): Promise<void>;
}
