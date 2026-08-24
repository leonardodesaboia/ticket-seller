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

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;
let sequence = 0;

function signFakeWebhook(body: Buffer, secret = 'fake-secret-for-dev'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
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
}, 120000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

afterEach(async () => {
  if (!prisma) return;
  await prisma.$executeRawUnsafe('DELETE FROM payment_disputes');
  await prisma.$executeRawUnsafe('DELETE FROM payment_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_credentials');
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
  await prisma.$executeRawUnsafe('DELETE FROM order_items');
  await prisma.$executeRawUnsafe('DELETE FROM order_pricing_snapshots');
  await prisma.$executeRawUnsafe('DELETE FROM orders');
  await prisma.$executeRawUnsafe('DELETE FROM reservation_items');
  await prisma.$executeRawUnsafe('DELETE FROM reservations');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_inventory');
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.$executeRawUnsafe('DELETE FROM payout_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payouts');
  await prisma.$executeRawUnsafe('DELETE FROM payout_recipients');
  await prisma.$executeRawUnsafe('DELETE FROM balance_settlements');
  await prisma.$executeRawUnsafe('DELETE FROM seller_balances');
  await prisma.$executeRawUnsafe('DELETE FROM ledger_entries');
  await prisma.$executeRawUnsafe('DELETE FROM ledger_transactions');
  await prisma.$executeRawUnsafe("DELETE FROM ledger_accounts WHERE organization_id IS NOT NULL");
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

// ---- Helpers ----

type ChargebackFixture = {
  organizationId: string;
  orderId: string;
  ticketTypeId: string;
  paymentAttemptId: string;
  externalPaymentId: string;
  attemptAmount: number;
};

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

async function createTicketsIssuedFixture(): Promise<ChargebackFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `chargeback-${unique}@test.com`, displayName: 'Chargeback Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Chargeback Org',
      slug: `chargeback-org-${unique}`,
      status: 'ACTIVE',
      ownerId: owner.id,
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Chargeback Event',
      status: 'PUBLISHED',
      slug: `chargeback-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      name: 'General',
      priceAmount: 5000,
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

  // Reserve
  const reservationRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 2 }] })
    .expect(201);

  const reservationId: string = reservationRes.body.reservationId as string;
  const reservationToken: string = reservationRes.body.token as string;

  // Create order
  const orderRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/orders')
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ reservationId })
    .expect(201);

  const orderId: string = orderRes.body.orderId as string;

  // Create payment attempt
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

  // Approve payment to reach TICKETS_ISSUED
  const approveBody = buildWebhookBody(externalPaymentId, 'PAYMENT_APPROVED', attemptAmount);
  await sendWebhook(approveBody, signFakeWebhook(approveBody)).expect(200);

  // Verify state
  const orderState = await prisma.$queryRaw<Array<{ status: string }>>`
    SELECT status FROM orders WHERE id = ${orderId}::uuid
  `;
  expect(orderState[0]!.status).toBe('TICKETS_ISSUED');

  return {
    organizationId: organization.id,
    orderId,
    ticketTypeId: ticketType.id,
    paymentAttemptId,
    externalPaymentId,
    attemptAmount,
  };
}

// ---- Tests ----

describe('Payment webhook — PAYMENT_DISPUTED (chargeback)', () => {
  it('1. PAYMENT_DISPUTED on TICKETS_ISSUED order → order becomes CHARGEBACK + tickets CANCELLED', async () => {
    const fixture = await createTicketsIssuedFixture();

    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_DISPUTED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    // Order transitioned to CHARGEBACK
    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('CHARGEBACK');

    // All tickets are CANCELLED
    const tickets = await prisma.$queryRaw<Array<{ status: string; cancelled_at: Date | null }>>`
      SELECT status, cancelled_at FROM tickets WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(tickets.length).toBeGreaterThan(0);
    for (const t of tickets) {
      expect(t.status).toBe('CANCELLED');
      expect(t.cancelled_at).not.toBeNull();
    }
  });

  it('2. dispute record persisted with status PROCESSED', async () => {
    const fixture = await createTicketsIssuedFixture();
    const eventId = randomUUID();
    const body = buildWebhookBody(
      fixture.externalPaymentId,
      'PAYMENT_DISPUTED',
      fixture.attemptAmount,
      'BRL',
      eventId,
    );
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const disputes = await prisma.$queryRaw<Array<{ status: string; external_dispute_id: string }>>`
      SELECT status, external_dispute_id FROM payment_disputes
      WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(disputes.length).toBe(1);
    expect(disputes[0]!.external_dispute_id).toBe(eventId);
    expect(disputes[0]!.status).toBe('PROCESSED');
  });

  it('3. outbox event order.chargeback.v1 emitted', async () => {
    const fixture = await createTicketsIssuedFixture();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_DISPUTED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: fixture.orderId, type: 'order.chargeback.v1' },
    });
    expect(outbox).not.toBeNull();
    const payload = outbox!.payload as Record<string, unknown>;
    expect(payload['orderId']).toBe(fixture.orderId);
    expect(payload['organizationId']).toBe(fixture.organizationId);
  });

  it('4. committed inventory released on chargeback', async () => {
    const fixture = await createTicketsIssuedFixture();

    const invBefore = await prisma.$queryRaw<Array<{ committed: number }>>`
      SELECT committed FROM ticket_inventory WHERE ticket_type_id = ${fixture.ticketTypeId}::uuid
    `;
    expect(Number(invBefore[0]!.committed)).toBe(2);

    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_DISPUTED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const invAfter = await prisma.$queryRaw<Array<{ committed: number }>>`
      SELECT committed FROM ticket_inventory WHERE ticket_type_id = ${fixture.ticketTypeId}::uuid
    `;
    expect(Number(invAfter[0]!.committed)).toBe(0);
  });

  it('5. duplicate PAYMENT_DISPUTED webhook → idempotent (order stays CHARGEBACK, single dispute record)', async () => {
    const fixture = await createTicketsIssuedFixture();
    const eventId = randomUUID();
    const body = buildWebhookBody(
      fixture.externalPaymentId,
      'PAYMENT_DISPUTED',
      fixture.attemptAmount,
      'BRL',
      eventId,
    );
    const sig = signFakeWebhook(body);

    // First call
    await sendWebhook(body, sig).expect(200);

    // Second call (duplicate)
    await sendWebhook(body, sig).expect(200);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('CHARGEBACK');

    // Only one dispute record
    const disputes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM payment_disputes
      WHERE provider = 'FAKE' AND external_dispute_id = ${eventId}
    `;
    expect(Number(disputes[0]!.count)).toBe(1);

    // Only one chargeback outbox event
    const outboxCount = await prisma.outboxEvent.count({
      where: { aggregateId: fixture.orderId, type: 'order.chargeback.v1' },
    });
    expect(outboxCount).toBe(1);
  });

  it('6. webhook from different org does not affect other org orders', async () => {
    // Create two independent fixtures
    const fixtureA = await createTicketsIssuedFixture();
    const fixtureB = await createTicketsIssuedFixture();

    // Send chargeback for fixture A only
    const body = buildWebhookBody(fixtureA.externalPaymentId, 'PAYMENT_DISPUTED', fixtureA.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    // Fixture A order is CHARGEBACK
    const orderA = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixtureA.orderId}::uuid
    `;
    expect(orderA[0]!.status).toBe('CHARGEBACK');

    // Fixture B order is still TICKETS_ISSUED
    const orderB = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixtureB.orderId}::uuid
    `;
    expect(orderB[0]!.status).toBe('TICKETS_ISSUED');
  });

  it('7. returns 400 for invalid signature', async () => {
    const fixture = await createTicketsIssuedFixture();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_DISPUTED', fixture.attemptAmount);

    await sendWebhook(body, 'sha256=invalidsig').expect(400);

    // Order unchanged
    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('TICKETS_ISSUED');
  });
});
