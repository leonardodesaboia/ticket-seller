export type PaymentProvider = 'FAKE';
export type PaymentMethod = 'FAKE_PIX' | 'FAKE_CREDIT_CARD';

export type InternalPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentWebhookEventType =
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_EXPIRED';

export interface CreatePaymentInput {
  idempotencyKey: string;
  orderId: string;
  organizationId: string;
  amount: bigint;
  currency: string;
  paymentMethod: PaymentMethod;
  description: string;
}

export interface FakePixData {
  type: 'PIX';
  qrCode: string;
  qrCodeText: string;
}

export interface FakeCreditCardData {
  type: 'CREDIT_CARD';
  clientToken: string;
}

export interface CreatePaymentResult {
  externalPaymentId: string;
  status: InternalPaymentStatus;
  checkoutData: FakePixData | FakeCreditCardData | null;
  expiresAt: Date;
}

export interface PaymentWebhookInput {
  provider: PaymentProvider;
  rawBody: Buffer;
  signature: string;
}

export interface ParsedPaymentWebhook {
  providerEventId: string;
  externalPaymentId: string;
  eventType: PaymentWebhookEventType;
  status: InternalPaymentStatus;
  amount: bigint;
  currency: string;
}

export interface RefundPaymentInput {
  externalPaymentId: string;
  amount: bigint;
  currency: string;
  idempotencyKey: string;
}

export interface RefundPaymentResult {
  externalRefundId: string;
  status: 'SUCCESS' | 'FAILED';
}

export interface PaymentGatewayPort {
  readonly provider: PaymentProvider;
  getSupportedMethods(): PaymentMethod[];
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(input: PaymentWebhookInput): Promise<ParsedPaymentWebhook>;
  refund(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');
