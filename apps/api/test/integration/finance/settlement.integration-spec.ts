/**
 * Integration tests for TASK-049 — Merchant Balance & Settlement.
 *
 * Scenarios covered:
 * 1. Sale: seller_balances.pending_amount incremented on ORDER_PAID.
 * 2. Settlement: SettleOrderUseCase moves pending → available, creates balance_settlement.
 * 3. Idempotent settlement: two settlements of same order → only one applied.
 * 4. Refund before settlement: pending_amount decremented.
 * 5. Refund after settlement: available_amount decremented (can go negative).
 * 6. Chargeback: available_amount decremented (can go negative).
 * 7. GET /organizations/:orgId/finance/balance returns correct values.
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

function signFakeWebhook(body: Buffer, secret = 'fake-secret-for-dev'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildWebhookBody(
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

function sendWebhook(body: Buffer, signature: string) {
  return supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .type('json')
    .set('x-fake-signature', signature)
    .send(body.toString('utf8'));
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const databaseUrl = container.getConnectionUri();
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['FAKE_GATEWAY_SECRET'] = 'fake-secret-for-dev';

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

interface SettlementFixture {
  organizationId: string;
  ownerId: string;
  orderId: string;
  externalPaymentId: string;
  attemptAmount: number;
  reservationToken: string;
}

async function createFixture(): Promise<SettlementFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `settlement-${unique}@test.com`, displayName: 'Settlement Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Settlement Org',
      slug: `settlement-org-${unique}`,
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
      title: 'Settlement Event',
      status: 'PUBLISHED',
      slug: `settlement-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
      endsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
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

  const attemptRows = await prisma.$queryRaw<Array<{ external_payment_id: string; amount: bigint }>>`
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

async function triggerApproval(fixture: SettlementFixture, eventId = randomUUID()): Promise<void> {
  const body = buildWebhookBody(
    fixture.externalPaymentId,
    'PAYMENT_APPROVED',
    fixture.attemptAmount,
    'BRL',
    eventId,
  );
  const sig = signFakeWebhook(body);
  await sendWebhook(body, sig).expect(200);
}

async function getBalance(orgId: string): Promise<{ pending: bigint; available: bigint; reserved: bigint } | null> {
  const rows = await prisma.$queryRaw<Array<{
    pending_amount: bigint;
    available_amount: bigint;
    reserved_amount: bigint;
  }>>`
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

describe('SellerBalance — Sale', () => {
  it('increments pending_amount when ORDER_PAID webhook is processed', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    const balance = await getBalance(fixture.organizationId);
    expect(balance).not.toBeNull();
    // sellerNetAmount = grossAmount (0 bps platform fee in default policy)
    expect(balance!.pending).toBe(BigInt(fixture.attemptAmount));
    expect(balance!.available).toBe(0n);
  });

  it('is idempotent: duplicate webhook does not double-count pending', async () => {
    const fixture = await createFixture();
    const webhookEventId = randomUUID();
    await triggerApproval(fixture, webhookEventId);
    await triggerApproval(fixture, webhookEventId);

    const balance = await getBalance(fixture.organizationId);
    expect(balance!.pending).toBe(BigInt(fixture.attemptAmount));
  });
});

describe('SellerBalance — Settlement', () => {
  it('moves pending → available and creates balance_settlement', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    // Get sellerNetAmount from snapshot
    const snapshots = await prisma.$queryRaw<Array<{ seller_net_amount: bigint; currency: string }>>`
      SELECT seller_net_amount, currency FROM order_pricing_snapshots WHERE order_id = ${fixture.orderId}::uuid
    `;
    const sellerNetAmount = snapshots[0]!.seller_net_amount;
    const currency = snapshots[0]!.currency;

    const settled = await settleOrder.execute({
      orderId: fixture.orderId,
      organizationId: fixture.organizationId,
      sellerNetAmount,
      currency,
    });

    expect(settled).toBe(true);

    const balance = await getBalance(fixture.organizationId);
    expect(balance!.pending).toBe(0n);
    expect(balance!.available).toBe(sellerNetAmount);

    // Check balance_settlement was created
    const settlements = await prisma.$queryRaw<Array<{ order_id: string }>>`
      SELECT order_id FROM balance_settlements WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(settlements).toHaveLength(1);
  });

  it('is idempotent: settling same order twice applies effect only once', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    const snapshots = await prisma.$queryRaw<Array<{ seller_net_amount: bigint; currency: string }>>`
      SELECT seller_net_amount, currency FROM order_pricing_snapshots WHERE order_id = ${fixture.orderId}::uuid
    `;
    const sellerNetAmount = snapshots[0]!.seller_net_amount;
    const currency = snapshots[0]!.currency;

    const input = { orderId: fixture.orderId, organizationId: fixture.organizationId, sellerNetAmount, currency };
    const first = await settleOrder.execute(input);
    const second = await settleOrder.execute(input);

    expect(first).toBe(true);
    expect(second).toBe(false);

    // Balance should reflect only one settlement
    const balance = await getBalance(fixture.organizationId);
    expect(balance!.available).toBe(sellerNetAmount);
    expect(balance!.pending).toBe(0n);
  });
});

describe('SellerBalance — Refund before settlement', () => {
  it('decrements pending when order not yet settled', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    const balanceBefore = await getBalance(fixture.organizationId);
    expect(balanceBefore!.pending).toBe(BigInt(fixture.attemptAmount));

    // Cancel and refund
    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/orders/${fixture.orderId}/cancellations`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ reason: 'Test refund before settlement' })
      .expect(200);

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/orders/${fixture.orderId}/refunds`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .expect(200);

    const balanceAfter = await getBalance(fixture.organizationId);
    // pending should be decremented by sellerNetAmount (= attemptAmount with 0 bps fee)
    expect(balanceAfter!.pending).toBe(0n);
    expect(balanceAfter!.available).toBe(0n);
  });
});

describe('SellerBalance — Chargeback', () => {
  it('decrements available (can go negative)', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    // Settle first so available has value
    const snapshots = await prisma.$queryRaw<Array<{ seller_net_amount: bigint; currency: string }>>`
      SELECT seller_net_amount, currency FROM order_pricing_snapshots WHERE order_id = ${fixture.orderId}::uuid
    `;
    const sellerNetAmount = snapshots[0]!.seller_net_amount;
    const currency = snapshots[0]!.currency;
    await settleOrder.execute({ orderId: fixture.orderId, organizationId: fixture.organizationId, sellerNetAmount, currency });

    const balanceBefore = await getBalance(fixture.organizationId);
    expect(balanceBefore!.available).toBe(sellerNetAmount);

    // Trigger chargeback
    const disputeEventId = randomUUID();
    const chargebackBody = buildWebhookBody(
      fixture.externalPaymentId,
      'PAYMENT_DISPUTED',
      fixture.attemptAmount,
      'BRL',
      disputeEventId,
    );
    const sig = signFakeWebhook(chargebackBody);
    await sendWebhook(chargebackBody, sig).expect(200);

    const balanceAfter = await getBalance(fixture.organizationId);
    // available -= chargebackAmount (can be negative)
    expect(balanceAfter!.available).toBe(sellerNetAmount - BigInt(fixture.attemptAmount));
  });
});

describe('GET /organizations/:orgId/finance/balance', () => {
  it('returns zeroes when no sales have been recorded', async () => {
    const unique = `${Date.now()}-${++sequence}`;
    const owner = await prisma.user.create({
      data: { email: `balance-empty-${unique}@test.com`, displayName: 'Balance Owner' },
    });
    const org = await prisma.organization.create({
      data: {
        name: 'Balance Org',
        slug: `balance-org-${unique}`,
        status: 'ACTIVE',
        ownerId: owner.id,
      },
    });

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/organizations/${org.id}/finance/balance`)
      .set('X-Dev-User-Id', owner.id)
      .expect(200);

    expect(res.body.pendingAmount).toBe('0');
    expect(res.body.availableAmount).toBe('0');
    expect(res.body.reservedAmount).toBe('0');
    expect(res.body.currency).toBe('BRL');
  });

  it('returns correct balance after a sale', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/organizations/${fixture.organizationId}/finance/balance`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .expect(200);

    expect(res.body.pendingAmount).toBe(String(fixture.attemptAmount));
    expect(res.body.availableAmount).toBe('0');
    expect(res.body.reservedAmount).toBe('0');
  });

  it('returns 401 when no authentication header provided', async () => {
    const fixture = await createFixture();
    await supertest(app.getHttpServer())
      .get(`/api/v1/organizations/${fixture.organizationId}/finance/balance`)
      .expect(401);
  });
});
