export const PAYOUT_GATEWAY_PORT = Symbol('PAYOUT_GATEWAY_PORT');

export interface CreateRecipientInput {
  organizationId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateRecipientOutput {
  externalRecipientId: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED';
}

export interface CreatePayoutInput {
  organizationId: string;
  externalRecipientId: string;
  amount: bigint;
  currency: string;
  idempotencyKey: string;
}

export interface CreatePayoutOutput {
  externalPayoutId: string;
  status: 'PROCESSING' | 'PAID' | 'FAILED';
}

export interface GetPayoutStatusOutput {
  externalPayoutId: string;
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  amount?: bigint;
  currency?: string;
}

export interface ParsedWebhookEvent {
  provider: string;
  providerEventId: string;
  externalPayoutId: string;
  eventType: 'SUCCEEDED' | 'FAILED';
  amount: bigint;
  currency: string;
  rawPayload: Record<string, unknown>;
}

export interface IPayoutGatewayPort {
  readonly provider: string;
  createRecipient(input: CreateRecipientInput): Promise<CreateRecipientOutput>;
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutOutput>;
  getPayoutStatus(externalPayoutId: string): Promise<GetPayoutStatusOutput>;
  parseWebhookEvent(rawBody: Buffer, signature: string): ParsedWebhookEvent;
}
