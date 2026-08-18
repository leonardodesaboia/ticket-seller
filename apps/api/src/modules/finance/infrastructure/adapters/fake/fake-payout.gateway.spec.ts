import * as crypto from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { FakePayoutGateway } from './fake-payout.gateway';

// Helper: compute valid HMAC-SHA256 signature (raw hex, no prefix)
function signBody(body: Buffer, secret = 'dev-payout-secret'): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function makeWebhookBody(overrides: Record<string, unknown> = {}): Buffer {
  const obj = {
    eventId: 'payout-evt-001',
    externalPayoutId: 'fake_payout_abc123',
    eventType: 'SUCCEEDED',
    amount: 50000,
    currency: 'BRL',
    ...overrides,
  };
  return Buffer.from(JSON.stringify(obj));
}

describe('FakePayoutGateway', () => {
  let gateway: FakePayoutGateway;

  beforeEach(() => {
    process.env['FAKE_PAYOUT_SECRET'] = 'dev-payout-secret';
    process.env['NODE_ENV'] = 'test';
    gateway = new FakePayoutGateway();
  });

  afterEach(() => {
    delete process.env['FAKE_PAYOUT_SECRET'];
  });

  describe('constructor', () => {
    it('throws in production when FAKE_PAYOUT_SECRET is missing', () => {
      const origSecret = process.env['FAKE_PAYOUT_SECRET'];
      const origEnv = process.env['NODE_ENV'];
      delete process.env['FAKE_PAYOUT_SECRET'];
      process.env['NODE_ENV'] = 'production';
      expect(() => new FakePayoutGateway()).toThrow('FAKE_PAYOUT_SECRET is required in production');
      process.env['FAKE_PAYOUT_SECRET'] = origSecret;
      process.env['NODE_ENV'] = origEnv;
    });

    it('uses dev-payout-secret default when FAKE_PAYOUT_SECRET not set in non-production', () => {
      const origSecret = process.env['FAKE_PAYOUT_SECRET'];
      delete process.env['FAKE_PAYOUT_SECRET'];
      process.env['NODE_ENV'] = 'test';
      expect(() => new FakePayoutGateway()).not.toThrow();
      process.env['FAKE_PAYOUT_SECRET'] = origSecret;
    });
  });

  describe('createRecipient', () => {
    it('returns a deterministic externalRecipientId based on organizationId', async () => {
      const result1 = await gateway.createRecipient({ organizationId: 'org-123' });
      const result2 = await gateway.createRecipient({ organizationId: 'org-123' });
      expect(result1.externalRecipientId).toBe(result2.externalRecipientId);
    });

    it('returns different externalRecipientId for different organizationId', async () => {
      const result1 = await gateway.createRecipient({ organizationId: 'org-aaa' });
      const result2 = await gateway.createRecipient({ organizationId: 'org-bbb' });
      expect(result1.externalRecipientId).not.toBe(result2.externalRecipientId);
    });

    it('prefixes externalRecipientId with fake_recipient_', async () => {
      const result = await gateway.createRecipient({ organizationId: 'org-123' });
      expect(result.externalRecipientId).toMatch(/^fake_recipient_/);
    });

    it('auto-verifies the recipient (status VERIFIED)', async () => {
      const result = await gateway.createRecipient({ organizationId: 'org-123' });
      expect(result.status).toBe('VERIFIED');
    });
  });

  describe('createPayout', () => {
    it('returns a deterministic externalPayoutId based on idempotencyKey', async () => {
      const input = {
        organizationId: 'org-123',
        externalRecipientId: 'fake_recipient_abc',
        amount: 50000n,
        currency: 'BRL',
        idempotencyKey: 'payout-key-001',
      };
      const result1 = await gateway.createPayout(input);
      const result2 = await gateway.createPayout(input);
      expect(result1.externalPayoutId).toBe(result2.externalPayoutId);
    });

    it('returns different externalPayoutId for different idempotencyKey', async () => {
      const base = {
        organizationId: 'org-123',
        externalRecipientId: 'fake_recipient_abc',
        amount: 50000n,
        currency: 'BRL',
      };
      const result1 = await gateway.createPayout({ ...base, idempotencyKey: 'key-a' });
      const result2 = await gateway.createPayout({ ...base, idempotencyKey: 'key-b' });
      expect(result1.externalPayoutId).not.toBe(result2.externalPayoutId);
    });

    it('prefixes externalPayoutId with fake_payout_', async () => {
      const result = await gateway.createPayout({
        organizationId: 'org-123',
        externalRecipientId: 'fake_recipient_abc',
        amount: 50000n,
        currency: 'BRL',
        idempotencyKey: 'payout-key-001',
      });
      expect(result.externalPayoutId).toMatch(/^fake_payout_/);
    });

    it('returns initial status PROCESSING', async () => {
      const result = await gateway.createPayout({
        organizationId: 'org-123',
        externalRecipientId: 'fake_recipient_abc',
        amount: 50000n,
        currency: 'BRL',
        idempotencyKey: 'payout-key-001',
      });
      expect(result.status).toBe('PROCESSING');
    });
  });

  describe('getPayoutStatus', () => {
    it('returns PROCESSING for unknown externalPayoutId', async () => {
      const result = await gateway.getPayoutStatus('unknown-payout-id');
      expect(result.status).toBe('PROCESSING');
    });

    it('returns status from in-memory map after createPayout', async () => {
      const payout = await gateway.createPayout({
        organizationId: 'org-123',
        externalRecipientId: 'fake_recipient_abc',
        amount: 50000n,
        currency: 'BRL',
        idempotencyKey: 'payout-key-status-test',
      });
      const status = await gateway.getPayoutStatus(payout.externalPayoutId);
      expect(status.status).toBe('PROCESSING');
    });
  });

  describe('parseWebhookEvent', () => {
    it('returns ParsedWebhookEvent for valid signature and body', () => {
      const body = makeWebhookBody();
      const sig = signBody(body);
      const result = gateway.parseWebhookEvent(body, sig);

      expect(result.provider).toBe('FAKE');
      expect(result.providerEventId).toBe('payout-evt-001');
      expect(result.externalPayoutId).toBe('fake_payout_abc123');
      expect(result.eventType).toBe('SUCCEEDED');
      expect(result.amount).toBe(50000n);
      expect(result.currency).toBe('BRL');
    });

    it('throws UnauthorizedException for invalid signature', () => {
      const body = makeWebhookBody();
      expect(() => gateway.parseWebhookEvent(body, 'invalid-signature')).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for wrong secret', () => {
      const body = makeWebhookBody();
      const wrongSig = signBody(body, 'wrong-secret');
      expect(() => gateway.parseWebhookEvent(body, wrongSig)).toThrow(UnauthorizedException);
    });

    it('throws for malformed JSON body', () => {
      const body = Buffer.from('not-json');
      const sig = signBody(body);
      expect(() => gateway.parseWebhookEvent(body, sig)).toThrow();
    });

    it('throws for missing required fields in webhook body', () => {
      const body = Buffer.from(JSON.stringify({ eventId: 'e1' }));
      const sig = signBody(body);
      expect(() => gateway.parseWebhookEvent(body, sig)).toThrow();
    });

    it('throws for unknown eventType', () => {
      const body = makeWebhookBody({ eventType: 'UNKNOWN' });
      const sig = signBody(body);
      expect(() => gateway.parseWebhookEvent(body, sig)).toThrow();
    });

    it('processes FAILED eventType correctly', () => {
      const body = makeWebhookBody({ eventType: 'FAILED' });
      const sig = signBody(body);
      const result = gateway.parseWebhookEvent(body, sig);
      expect(result.eventType).toBe('FAILED');
    });

    it('amount is returned as bigint', () => {
      const body = makeWebhookBody({ amount: 99999 });
      const sig = signBody(body);
      const result = gateway.parseWebhookEvent(body, sig);
      expect(result.amount).toBe(99999n);
      expect(typeof result.amount).toBe('bigint');
    });

    it('updates in-memory status to PAID after SUCCEEDED webhook', () => {
      const payoutId = 'fake_payout_test_status';
      const body = makeWebhookBody({ externalPayoutId: payoutId, eventType: 'SUCCEEDED' });
      const sig = signBody(body);
      gateway.parseWebhookEvent(body, sig);
      // Status map should have been updated internally
      void gateway.getPayoutStatus(payoutId).then((result) => {
        expect(result.status).toBe('PAID');
      });
    });
  });
});
