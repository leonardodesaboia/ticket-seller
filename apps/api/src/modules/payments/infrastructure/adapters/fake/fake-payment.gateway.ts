import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  FakeCreditCardData,
  FakePixData,
  InternalPaymentStatus,
  ParsedPaymentWebhook,
  PaymentGatewayPort,
  PaymentMethod,
  PaymentProvider,
  PaymentWebhookEventType,
  PaymentWebhookInput,
  RefundPaymentInput,
  RefundPaymentResult,
} from '../../../domain/ports/payment-gateway.port';
import { GatewayError, WebhookSignatureError } from '../../../domain/payment-gateway.errors';

const WEBHOOK_EVENT_TYPE_TO_STATUS: Record<PaymentWebhookEventType, InternalPaymentStatus> = {
  PAYMENT_APPROVED: 'APPROVED',
  PAYMENT_DECLINED: 'DECLINED',
  PAYMENT_CANCELLED: 'CANCELLED',
  PAYMENT_EXPIRED: 'EXPIRED',
};

interface FakeWebhookBody {
  eventId: string;
  externalPaymentId: string;
  eventType: string;
  amount: number;
  currency: string;
}

@Injectable()
export class FakePaymentGateway implements PaymentGatewayPort {
  readonly provider: PaymentProvider = 'FAKE';
  private readonly secret: string;
  private readonly logger = new Logger(FakePaymentGateway.name);

  constructor() {
    const secret = process.env['FAKE_GATEWAY_SECRET'];
    if (!secret) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('FAKE_GATEWAY_SECRET is required in production');
      }
      this.logger.warn('FAKE_GATEWAY_SECRET not set — using insecure default for development');
      this.secret = 'fake-secret-for-dev';
    } else {
      this.secret = secret;
    }
  }

  getSupportedMethods(): PaymentMethod[] {
    return ['FAKE_PIX', 'FAKE_CREDIT_CARD'];
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const externalPaymentId =
      'fake_' + crypto.createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 32);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let checkoutData: FakePixData | FakeCreditCardData | null = null;
    if (input.paymentMethod === 'FAKE_PIX') {
      checkoutData = {
        type: 'PIX',
        qrCode: `data:image/png;base64,FAKE_QR_${externalPaymentId}`,
        qrCodeText: `00020126580014br.gov.bcb.pix0136${externalPaymentId}5204000053039865802BR5913Ticket Seller6009Sao Paulo62070503***6304FAKE`,
      };
    } else if (input.paymentMethod === 'FAKE_CREDIT_CARD') {
      checkoutData = {
        type: 'CREDIT_CARD',
        clientToken: `fake_token_${externalPaymentId}`,
      };
    }

    return {
      externalPaymentId,
      status: 'PENDING',
      checkoutData,
      expiresAt,
    };
  }

  async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const externalRefundId =
      'fake_refund_' + crypto.createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 24);
    return { externalRefundId, status: 'SUCCESS' };
  }

  async parseWebhook(input: PaymentWebhookInput): Promise<ParsedPaymentWebhook> {
    // Validate signature
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(input.rawBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(`sha256=${expected}`, 'utf8');
    const receivedBuffer = Buffer.from(input.signature, 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new WebhookSignatureError();
    }

    // Parse body
    let body: FakeWebhookBody;
    try {
      body = JSON.parse(input.rawBody.toString('utf8')) as FakeWebhookBody;
    } catch {
      throw new GatewayError('Invalid webhook body');
    }

    if (!body.eventId || !body.externalPaymentId || !body.eventType || body.amount == null || !body.currency) {
      throw new GatewayError('Missing required webhook fields');
    }

    const validEventTypes: PaymentWebhookEventType[] = [
      'PAYMENT_APPROVED',
      'PAYMENT_DECLINED',
      'PAYMENT_CANCELLED',
      'PAYMENT_EXPIRED',
    ];

    if (!validEventTypes.includes(body.eventType as PaymentWebhookEventType)) {
      throw new GatewayError(`Unknown event type: ${body.eventType}`);
    }

    const eventType = body.eventType as PaymentWebhookEventType;
    const status = WEBHOOK_EVENT_TYPE_TO_STATUS[eventType];

    return {
      providerEventId: body.eventId,
      externalPaymentId: body.externalPaymentId,
      eventType,
      status,
      amount: BigInt(body.amount),
      currency: body.currency,
    };
  }
}
