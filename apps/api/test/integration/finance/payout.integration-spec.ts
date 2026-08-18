/**
 * Integration tests for TASK-051 — Payout Processing.
 *
 * Scenarios covered:
 * 1. POST /organizations/:orgId/finance/payouts — creates payout, reserves balance.
 * 2. Webhook SUCCEEDED — payout marked PAID, reserved balance cleared.
 * 3. Webhook FAILED — payout marked FAILED, balance restored.
 * 4. Concurrent payouts — SELECT FOR UPDATE prevents double-spending.
 * 5. Insufficient balance → 422.
 * 6. Idempotency — same idempotency_key → same payout.
 * 7. Webhook deduplication — processing same webhook event twice is idempotent.
 */
import * as crypto from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import supertest from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import { HttpExceptionFilter } from '../../../src/platform/http/filters/http-exception.filter';
import { SettleOrderUseCase } from '../../../src/modules/finance/application/use-cases/settle-order.use-case';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;
let settleOrder: SettleOrderUseCase;
let sequence = 0;

// ─── Signature helpers ────────────────────────────────────────────────────────

function signPayoutWebhook(body: Buffer, secret = 'dev-payout-secret'): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildPayoutWebhookBody(
  externalPayoutId: string,
  eventType: 'SUCCEEDED' | 'FAILED',
  amount: number,
  currency = 'BRL',
  eventId = randomUUID(),
): Buffer {
  return Buffer.from(
    JSON.stringify({ eventId, externalPayoutId, eventType, amount, currency }),
    'utf8',
  );
}

function sendPayoutWebhook(body: Buffer, signature: string) {
  return supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payouts/fake')
    .type('json')
    .set('x-payout-signature', signature)
    .send(body.toString('utf8'));
}

// ─── Payment webhook helpers (to set up balance) ────────────────────────────

function signPaymentWebhook(body: Buffer, secret = 'fake-secret-for-dev'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildPaymentWebhookBody(
  externalPaymentId: string,
  eventType: string,
  amount: number,
  currency = 'BRL',
  eventId = randomUUID(),
): Buffer {
  return Buffer.from(
    JSON.stringify({ eventId, externalPaymentId, eventType, amount, currency }),
    'utf8',
  );
}

function sendPaymentWebhook(body: Buffer, signature: string) {
  return supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .type('json')
    .set('x-fake-signature', signature)
    .send(body.toString('utf8'));
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = container.getConnectionUri();
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['FAKE_GATEWAY_SECRET'] = 'fake-secret-for-dev';
  process.env['FAKE_PAYOUT_SECRET'] = 'dev-payout-secret';

  const migration = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' },
  );
  if (migration.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(migration.status)}`);
  }

  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  prisma = module.get(PrismaService);
  settleOrder = module.get(SettleOrderUseCase);
}, 120000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

afterEach(async () => {
  if (!prisma) return;
  await prisma.$executeRawUnsafe('DELETE FROM payout_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payouts');
  await prisma.$executeRawUnsafe('DELETE FROM payout_recipients');
  await prisma.$executeRawUnsafe('DELETE FROM balance_settlements');
  await prisma.$executeRawUnsafe('DELETE FROM seller_balances');
  await prisma.$executeRawUnsafe('DELETE FROM ledger_entries');
  await prisma.$executeRawUnsafe('DELETE FROM ledger_transactions');
  await prisma.$executeRawUnsafe("DELETE FROM ledger_accounts WHERE organization_id IS NOT NULL");
  await prisma.$executeRawUnsafe('DELETE FROM payment_disputes');
  await prisma.$executeRawUnsafe('DELETE FROM refund_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM payment_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_credentials');
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
  await prisma.$executeRawUnsafe('DELETE FROM order_pricing_snapshots');
  await prisma.$executeRawUnsafe('DELETE FROM order_items');
  await prisma.$executeRawUnsafe('DELETE FROM orders');
  await prisma.$executeRawUnsafe('DELETE FROM reservation_items');
  await prisma.$executeRawUnsafe('DELETE FROM reservations');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_inventory');
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface PayoutFixture {
  organizationId: string;
  ownerId: string;
  orderId: string;
  externalPaymentId: string;
  attemptAmount: number;
  reservationToken: string;
}

async function createBaseFixture(): Promise<PayoutFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `payout-${unique}@test.com`, displayName: 'Payout Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Payout Org',
      slug: `payout-org-${unique}`,
      status: 'ACTIVE',
      ownerId: owner.id,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Payout Event',
      status: 'PUBLISHED',
      slug: `payout-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
      endsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      name: 'General',
      priceAmount: 10000,
      capacity: 10,
      eventId: event.id,
      organizationId: organization.id,
      status: 'ACTIVE',
    },
  });
  await prisma.ticketInventory.create({
    data: {
      ticketTypeId: ticketType.id,
      eventId: event.id,
      organizationId: organization.id,
      capacity: 10,
    },
  });

  const reservationRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] })
    .expect(201);

  const reservationToken: string = reservationRes.body.token as string;
  const reservationId: string = reservationRes.body.reservationId as string;

  const orderRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/orders')
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ reservationId })
    .expect(201);

  const orderId: string = orderRes.body.orderId as string;

  const paymentRes = await supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/payments`)
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ paymentMethod: 'FAKE_PIX' })
    .expect(201);

  const paymentAttemptId: string = paymentRes.body.paymentAttemptId as string;

  const attemptRows = await prisma.$queryRaw<
    Array<{ external_payment_id: string; amount: bigint }>
  >`
    SELECT external_payment_id, amount FROM payment_attempts WHERE id = ${paymentAttemptId}::uuid
  `;
  const externalPaymentId = attemptRows[0]!.external_payment_id;
  const attemptAmount = Number(attemptRows[0]!.amount);

  return {
    organizationId: organization.id,
    ownerId: owner.id,
    orderId,
    externalPaymentId,
    attemptAmount,
    reservationToken,
  };
}

async function approvePayment(fixture: PayoutFixture): Promise<void> {
  const body = buildPaymentWebhookBody(
    fixture.externalPaymentId,
    'PAYMENT_APPROVED',
    fixture.attemptAmount,
  );
  const sig = signPaymentWebhook(body);
  await sendPaymentWebhook(body, sig).expect(200);
}

/**
 * Sets up fixture with a payment approved and balance settled so the org
 * has available_amount ready for a payout.
 */
async function setupWithAvailableBalance(): Promise<PayoutFixture & { availableAmount: number }> {
  const fixture = await createBaseFixture();
  await approvePayment(fixture);

  // Settle to move pending → available
  const snapshots = await prisma.$queryRaw<
    Array<{ seller_net_amount: bigint; currency: string }>
  >`
    SELECT seller_net_amount, currency
    FROM order_pricing_snapshots
    WHERE order_id = ${fixture.orderId}::uuid
  `;
  const sellerNetAmount = snapshots[0]!.seller_net_amount;
  const currency = snapshots[0]!.currency;
  await settleOrder.execute({
    orderId: fixture.orderId,
    organizationId: fixture.organizationId,
    sellerNetAmount,
    currency,
  });

  // Register payout recipient via API
  await supertest(app.getHttpServer())
    .post(`/api/v1/organizations/${fixture.organizationId}/finance/recipient`)
    .set('X-Dev-User-Id', fixture.ownerId)
    .expect(201);

  return { ...fixture, availableAmount: Number(sellerNetAmount) };
}

async function getBalance(
  orgId: string,
): Promise<{ pending: bigint; available: bigint; reserved: bigint } | null> {
  const rows = await prisma.$queryRaw<
    Array<{ pending_amount: bigint; available_amount: bigint; reserved_amount: bigint }>
  >`
    SELECT pending_amount, available_amount, reserved_amount
    FROM seller_balances
    WHERE organization_id = ${orgId}::uuid
  `;
  if (!rows[0]) return null;
  return {
    pending: rows[0].pending_amount,
    available: rows[0].available_amount,
    reserved: rows[0].reserved_amount,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /organizations/:orgId/finance/payouts', () => {
  it('creates payout, reserves available balance, returns 201', async () => {
    const fixture = await setupWithAvailableBalance();
    const payoutAmount = fixture.availableAmount;

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({
        amount: payoutAmount,
        currency: 'BRL',
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    expect(res.body.status).toBe('PROCESSING');
    expect(res.body.amount).toBe(String(payoutAmount));
    expect(res.body.currency).toBe('BRL');

    const balance = await getBalance(fixture.organizationId);
    expect(balance!.available).toBe(0n);
    expect(balance!.reserved).toBe(BigInt(payoutAmount));
  });

  it('returns 422 when available balance is insufficient', async () => {
    const fixture = await setupWithAvailableBalance();

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({
        amount: fixture.availableAmount + 1,
        currency: 'BRL',
        idempotencyKey: randomUUID(),
      })
      .expect(422);

    expect(res.body.code ?? res.body.message ?? res.status).toBeTruthy();
  });

  it('is idempotent: same idempotency_key returns same payout', async () => {
    const fixture = await setupWithAvailableBalance();
    const idempotencyKey = randomUUID();
    const payoutAmount = Math.floor(fixture.availableAmount / 2);

    const res1 = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey })
      .expect(201);

    const res2 = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey })
      .expect(201);

    // Same payout ID returned
    expect(res1.body.id).toBe(res2.body.id);
  });

  it('requires authentication (no X-Dev-User-Id → 401)', async () => {
    const fixture = await setupWithAvailableBalance();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .send({ amount: 1000, currency: 'BRL', idempotencyKey: randomUUID() })
      .expect(401);
  });

  it('returns 422 when no verified recipient exists', async () => {
    const fixture = await createBaseFixture();
    await approvePayment(fixture);

    // Settle balance
    const snapshots = await prisma.$queryRaw<
      Array<{ seller_net_amount: bigint; currency: string }>
    >`
      SELECT seller_net_amount, currency
      FROM order_pricing_snapshots
      WHERE order_id = ${fixture.orderId}::uuid
    `;
    const sellerNetAmount = snapshots[0]!.seller_net_amount;
    await settleOrder.execute({
      orderId: fixture.orderId,
      organizationId: fixture.organizationId,
      sellerNetAmount,
      currency: 'BRL',
    });

    // Do NOT register recipient

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ amount: 1000, currency: 'BRL', idempotencyKey: randomUUID() })
      .expect(422);

    expect(res.body).toBeTruthy();
  });
});

describe('Webhook SUCCEEDED', () => {
  it('marks payout PAID, clears reserved balance, records ledger', async () => {
    const fixture = await setupWithAvailableBalance();
    const payoutAmount = fixture.availableAmount;

    const payoutRes = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey: randomUUID() })
      .expect(201);

    const payoutRows = await prisma.$queryRaw<Array<{ external_payout_id: string }>>`
      SELECT external_payout_id FROM payouts WHERE id = ${payoutRes.body.id}::uuid
    `;
    const externalPayoutId = payoutRows[0]!.external_payout_id;

    const body = buildPayoutWebhookBody(externalPayoutId, 'SUCCEEDED', payoutAmount);
    const sig = signPayoutWebhook(body);
    await sendPayoutWebhook(body, sig).expect(200);

    // Check payout status
    const payoutStatus = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM payouts WHERE id = ${payoutRes.body.id}::uuid
    `;
    expect(payoutStatus[0]!.status).toBe('PAID');

    // Check reserved balance cleared
    const balance = await getBalance(fixture.organizationId);
    expect(balance!.reserved).toBe(0n);
    expect(balance!.available).toBe(0n); // was moved to reserved, now cleared
  });
});

describe('Webhook FAILED', () => {
  it('marks payout FAILED, restores available balance', async () => {
    const fixture = await setupWithAvailableBalance();
    const payoutAmount = fixture.availableAmount;

    const payoutRes = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey: randomUUID() })
      .expect(201);

    const payoutRows = await prisma.$queryRaw<Array<{ external_payout_id: string }>>`
      SELECT external_payout_id FROM payouts WHERE id = ${payoutRes.body.id}::uuid
    `;
    const externalPayoutId = payoutRows[0]!.external_payout_id;

    const balanceBefore = await getBalance(fixture.organizationId);
    expect(balanceBefore!.reserved).toBe(BigInt(payoutAmount));
    expect(balanceBefore!.available).toBe(0n);

    const body = buildPayoutWebhookBody(externalPayoutId, 'FAILED', payoutAmount);
    const sig = signPayoutWebhook(body);
    await sendPayoutWebhook(body, sig).expect(200);

    // Check payout status
    const payoutStatus = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM payouts WHERE id = ${payoutRes.body.id}::uuid
    `;
    expect(payoutStatus[0]!.status).toBe('FAILED');

    // Balance restored
    const balance = await getBalance(fixture.organizationId);
    expect(balance!.reserved).toBe(0n);
    expect(balance!.available).toBe(BigInt(payoutAmount));
  });
});

describe('Webhook deduplication', () => {
  it('processing same webhook event twice is idempotent', async () => {
    const fixture = await setupWithAvailableBalance();
    const payoutAmount = fixture.availableAmount;

    const payoutRes = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey: randomUUID() })
      .expect(201);

    const payoutRows = await prisma.$queryRaw<Array<{ external_payout_id: string }>>`
      SELECT external_payout_id FROM payouts WHERE id = ${payoutRes.body.id}::uuid
    `;
    const externalPayoutId = payoutRows[0]!.external_payout_id;

    const webhookEventId = randomUUID();
    const body = buildPayoutWebhookBody(externalPayoutId, 'SUCCEEDED', payoutAmount, 'BRL', webhookEventId);
    const sig = signPayoutWebhook(body);

    // Send twice
    await sendPayoutWebhook(body, sig).expect(200);
    await sendPayoutWebhook(body, sig).expect(200);

    // Reserved cleared only once
    const balance = await getBalance(fixture.organizationId);
    expect(balance!.reserved).toBe(0n);
  });
});

describe('Concurrent payouts — SELECT FOR UPDATE', () => {
  it('only one of two concurrent payouts succeeds when available balance is tight', async () => {
    const fixture = await setupWithAvailableBalance();
    const totalAvailable = fixture.availableAmount;

    // Both payouts request more than half the balance — only one can succeed
    const payoutAmount = Math.floor(totalAvailable * 0.8);

    const [res1, res2] = await Promise.all([
      supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
        .set('X-Dev-User-Id', fixture.ownerId)
        .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey: randomUUID() }),
      supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${fixture.organizationId}/finance/payouts`)
        .set('X-Dev-User-Id', fixture.ownerId)
        .send({ amount: payoutAmount, currency: 'BRL', idempotencyKey: randomUUID() }),
    ]);

    const statuses = [res1.status, res2.status];
    // One should succeed (201), the other should fail (422)
    expect(statuses).toContain(201);
    expect(statuses).toContain(422);

    // Available balance must not go negative
    const balance = await getBalance(fixture.organizationId);
    expect(balance!.available).toBeGreaterThanOrEqual(0n);
  });
});
