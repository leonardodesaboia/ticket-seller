import * as crypto from 'node:crypto';
import { FakePaymentGateway } from './fake-payment.gateway';
import { WebhookSignatureError, GatewayError } from '../../../domain/payment-gateway.errors';
import { CreatePaymentInput } from '../../../domain/ports/payment-gateway.port';

// Helper: generate valid signature
function signBody(body: Buffer, secret = 'fake-secret-for-dev'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function makeInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    idempotencyKey: 'test-idempotency-key',
    orderId: 'order-id',
    organizationId: 'org-id',
    amount: 10000n,
    currency: 'BRL',
    paymentMethod: 'FAKE_PIX',
    description: 'Test payment',
    ...overrides,
  };
}

describe('FakePaymentGateway', () => {
  let gateway: FakePaymentGateway;

  beforeEach(() => {
    process.env['FAKE_GATEWAY_SECRET'] = 'fake-secret-for-dev';
    process.env['NODE_ENV'] = 'test';
    gateway = new FakePaymentGateway();
  });

  describe('createPayment', () => {
    it('returns deterministic externalPaymentId for same idempotencyKey', async () => {
      const result1 = await gateway.createPayment(makeInput({ idempotencyKey: 'key-a' }));
      const result2 = await gateway.createPayment(makeInput({ idempotencyKey: 'key-a' }));
      expect(result1.externalPaymentId).toBe(result2.externalPaymentId);
    });

    it('returns different externalPaymentId for different idempotencyKey', async () => {
      const result1 = await gateway.createPayment(makeInput({ idempotencyKey: 'key-a' }));
      const result2 = await gateway.createPayment(makeInput({ idempotencyKey: 'key-b' }));
      expect(result1.externalPaymentId).not.toBe(result2.externalPaymentId);
    });

    it('returns PIX checkoutData for FAKE_PIX method', async () => {
      const result = await gateway.createPayment(makeInput({ paymentMethod: 'FAKE_PIX' }));
      expect(result.checkoutData).toMatchObject({ type: 'PIX' });
      expect((result.checkoutData as { qrCodeText: string }).qrCodeText).toBeTruthy();
    });

    it('returns CREDIT_CARD checkoutData for FAKE_CREDIT_CARD method', async () => {
      const result = await gateway.createPayment(makeInput({ paymentMethod: 'FAKE_CREDIT_CARD' }));
      expect(result.checkoutData).toMatchObject({ type: 'CREDIT_CARD' });
    });

    it('always returns status PENDING', async () => {
      const result = await gateway.createPayment(makeInput());
      expect(result.status).toBe('PENDING');
    });

    it('sets expiresAt ~15 minutes from now', async () => {
      const before = Date.now();
      const result = await gateway.createPayment(makeInput());
      const after = Date.now();
      const expMs = result.expiresAt.getTime();
      expect(expMs).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
      expect(expMs).toBeLessThanOrEqual(after + 16 * 60 * 1000);
    });

    it('does not include secret in result', async () => {
      const result = await gateway.createPayment(makeInput());
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('fake-secret-for-dev');
    });
  });

  describe('parseWebhook', () => {
    const validBody = (overrides: Record<string, unknown> = {}) => {
      const obj = {
        eventId: 'evt-001',
        externalPaymentId: 'fake_abc',
        eventType: 'PAYMENT_APPROVED',
        amount: 10000,
        currency: 'BRL',
        ...overrides,
      };
      return Buffer.from(JSON.stringify(obj));
    };

    it('returns ParsedPaymentWebhook for valid signature', async () => {
      const body = validBody();
      const result = await gateway.parseWebhook({
        provider: 'FAKE',
        rawBody: body,
        signature: signBody(body),
      });
      expect(result.eventType).toBe('PAYMENT_APPROVED');
      expect(result.status).toBe('APPROVED');
      expect(result.amount).toBe(10000n);
      expect(result.currency).toBe('BRL');
    });

    it('throws WebhookSignatureError for invalid signature', async () => {
      const body = validBody();
      await expect(
        gateway.parseWebhook({ provider: 'FAKE', rawBody: body, signature: 'sha256=invalid' }),
      ).rejects.toThrow(WebhookSignatureError);
    });

    it('throws GatewayError for malformed body', async () => {
      const body = Buffer.from('not-json');
      await expect(
        gateway.parseWebhook({ provider: 'FAKE', rawBody: body, signature: signBody(body) }),
      ).rejects.toThrow(GatewayError);
    });

    it.each([
      ['PAYMENT_APPROVED', 'APPROVED'],
      ['PAYMENT_DECLINED', 'DECLINED'],
      ['PAYMENT_CANCELLED', 'CANCELLED'],
      ['PAYMENT_EXPIRED', 'EXPIRED'],
    ])('maps %s to status %s', async (eventType, expectedStatus) => {
      const body = validBody({ eventType });
      const result = await gateway.parseWebhook({
        provider: 'FAKE',
        rawBody: body,
        signature: signBody(body),
      });
      expect(result.status).toBe(expectedStatus);
    });

    it('throws GatewayError for unknown eventType', async () => {
      const body = validBody({ eventType: 'UNKNOWN_EVENT' });
      await expect(
        gateway.parseWebhook({ provider: 'FAKE', rawBody: body, signature: signBody(body) }),
      ).rejects.toThrow(GatewayError);
    });
  });

  describe('constructor', () => {
    it('throws in production when FAKE_GATEWAY_SECRET is missing', () => {
      const origSecret = process.env['FAKE_GATEWAY_SECRET'];
      const origEnv = process.env['NODE_ENV'];
      delete process.env['FAKE_GATEWAY_SECRET'];
      process.env['NODE_ENV'] = 'production';
      expect(() => new FakePaymentGateway()).toThrow('FAKE_GATEWAY_SECRET is required in production');
      process.env['FAKE_GATEWAY_SECRET'] = origSecret;
      process.env['NODE_ENV'] = origEnv;
    });
  });

  describe('getSupportedMethods', () => {
    it('returns FAKE_PIX and FAKE_CREDIT_CARD', () => {
      expect(gateway.getSupportedMethods()).toEqual(['FAKE_PIX', 'FAKE_CREDIT_CARD']);
    });
  });
});
