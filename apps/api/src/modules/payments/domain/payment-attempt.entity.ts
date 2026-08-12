export type PaymentAttemptStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentAttemptProvider = 'FAKE';
export type PaymentAttemptMethod = 'FAKE_PIX' | 'FAKE_CREDIT_CARD';

export interface PaymentAttemptProps {
  id: string;
  organizationId: string;
  orderId: string;
  provider: PaymentAttemptProvider;
  externalPaymentId: string | null;
  status: PaymentAttemptStatus;
  paymentMethod: PaymentAttemptMethod;
  amount: bigint;
  currency: string;
  idempotencyKey: string | null;
  failureCode: string | null;
  checkoutData: Record<string, unknown> | null;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentAttempt {
  readonly id: string;
  readonly organizationId: string;
  readonly orderId: string;
  readonly provider: PaymentAttemptProvider;
  readonly externalPaymentId: string | null;
  readonly status: PaymentAttemptStatus;
  readonly paymentMethod: PaymentAttemptMethod;
  readonly amount: bigint;
  readonly currency: string;
  readonly idempotencyKey: string | null;
  readonly failureCode: string | null;
  readonly checkoutData: Record<string, unknown> | null;
  readonly expiresAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PaymentAttemptProps) {
    if (props.amount <= 0n) throw new Error('PaymentAttempt amount must be positive');
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.orderId = props.orderId;
    this.provider = props.provider;
    this.externalPaymentId = props.externalPaymentId;
    this.status = props.status;
    this.paymentMethod = props.paymentMethod;
    this.amount = props.amount;
    this.currency = props.currency;
    this.idempotencyKey = props.idempotencyKey;
    this.failureCode = props.failureCode;
    this.checkoutData = props.checkoutData;
    this.expiresAt = props.expiresAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isActive(): boolean {
    return this.status === 'PENDING' || this.status === 'PROCESSING';
  }

  isTerminal(): boolean {
    return ['APPROVED', 'DECLINED', 'CANCELLED', 'EXPIRED'].includes(this.status);
  }
}
