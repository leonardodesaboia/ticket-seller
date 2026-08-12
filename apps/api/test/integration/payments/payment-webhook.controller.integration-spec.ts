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

type WebhookFixture = {
  organizationId: string;
  slug: string;
  ticketTypeId: string;
  orderId: string;
  reservationToken: string;
  paymentAttemptId: string;
  externalPaymentId: string;
  /** Amount in the smallest currency unit (e.g. centavos) */
  attemptAmount: number;
};

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
  // rawBody: true causes the FastifyAdapter to populate req.rawBody on every request,
  // enabling HMAC-SHA256 webhook signature verification without third-party plugins.
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
  await prisma.$executeRawUnsafe('DELETE FROM payment_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
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

async function createWebhookFixture(): Promise<WebhookFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  // Create org + event
  const owner = await prisma.user.create({
    data: { email: `webhook-${unique}@test.com`, displayName: 'Webhook Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Webhook Org', slug: `webhook-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Webhook Event',
      status: 'PUBLISHED',
      slug: `webhook-event-${unique}`,
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

  // Create reservation via API
  const reservationRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 2 }] })
    .expect(201);

  const reservationId: string = reservationRes.body.reservationId as string;
  const reservationToken: string = reservationRes.body.token as string;

  // Create order via API
  const orderRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/orders')
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ reservationId })
    .expect(201);

  const orderId: string = orderRes.body.orderId as string;

  // Create payment attempt via API
  const paymentRes = await supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/payments`)
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ paymentMethod: 'FAKE_PIX' })
    .expect(201);

  const paymentAttemptId: string = paymentRes.body.paymentAttemptId as string;

  // externalPaymentId is not in the payment response DTO — read it from the DB
  const attemptRows = await prisma.$queryRaw<Array<{ external_payment_id: string; amount: bigint }>>`
    SELECT external_payment_id, amount FROM payment_attempts WHERE id = ${paymentAttemptId}::uuid
  `;
  const externalPaymentId = attemptRows[0]!.external_payment_id;
  const attemptAmount = Number(attemptRows[0]!.amount);

  return {
    organizationId: organization.id,
    slug: event.slug!,
    ticketTypeId: ticketType.id,
    orderId,
    reservationToken,
    paymentAttemptId,
    externalPaymentId,
    attemptAmount,
  };
}

/**
 * Builds a deterministic JSON body buffer for a fake payment webhook event.
 * The signature must be computed from this exact buffer.
 */
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

/**
 * Sends the webhook as a raw JSON string.
 * The signature MUST be computed from the same buffer that builds this string.
 * We use .send(string) which, combined with .type('json'), sends the string as-is
 * (no re-serialization by supertest) with Content-Type: application/json.
 */
function sendWebhook(body: Buffer, signature: string) {
  return supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .type('json')
    .set('x-fake-signature', signature)
    .send(body.toString('utf8'));
}

describe('Payment webhook — PAYMENT_APPROVED', () => {
  it('returns 200 and marks order as PAID', async () => {
    const fixture = await createWebhookFixture();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount);
    const sig = signFakeWebhook(body);

    await sendWebhook(body, sig).expect(200);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('PAID');

    const attempt = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM payment_attempts WHERE id = ${fixture.paymentAttemptId}::uuid
    `;
    expect(attempt[0]!.status).toBe('APPROVED');
  });

  it('commits inventory: committed increases, reserved decreases', async () => {
    const fixture = await createWebhookFixture();

    const inventoryBefore = await prisma.$queryRaw<Array<{ reserved: number; committed: number }>>`
      SELECT reserved, committed FROM ticket_inventory
      WHERE ticket_type_id = ${fixture.ticketTypeId}::uuid
    `;
    const reservedBefore = Number(inventoryBefore[0]!.reserved);
    const committedBefore = Number(inventoryBefore[0]!.committed);

    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const inventoryAfter = await prisma.$queryRaw<Array<{ reserved: number; committed: number }>>`
      SELECT reserved, committed FROM ticket_inventory
      WHERE ticket_type_id = ${fixture.ticketTypeId}::uuid
    `;
    expect(Number(inventoryAfter[0]!.committed)).toBe(committedBefore + 2);
    expect(Number(inventoryAfter[0]!.reserved)).toBe(reservedBefore - 2);
  });

  it('writes outbox events: payment.approved.v1, order.paid.v1, inventory.committed.v1', async () => {
    const fixture = await createWebhookFixture();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: { in: [fixture.paymentAttemptId, fixture.orderId] } },
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('payment.approved.v1');
    expect(types).toContain('order.paid.v1');
    expect(types).toContain('inventory.committed.v1');
  });

  it('is idempotent: second identical webhook returns 200 without duplicating effects', async () => {
    const fixture = await createWebhookFixture();
    const eventId = randomUUID();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount, 'BRL', eventId);
    const sig = signFakeWebhook(body);

    await sendWebhook(body, sig).expect(200);
    await sendWebhook(body, sig).expect(200);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('PAID');

    // Inventory committed should reflect exactly 2 tickets (the quantity), not 4
    const inventory = await prisma.$queryRaw<Array<{ committed: number }>>`
      SELECT committed FROM ticket_inventory WHERE ticket_type_id = ${fixture.ticketTypeId}::uuid
    `;
    expect(Number(inventory[0]!.committed)).toBe(2);

    // Webhook event record should be exactly 1
    const webhookEvents = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM payment_webhook_events
      WHERE provider_event_id = ${eventId}
    `;
    expect(Number(webhookEvents[0]!.count)).toBe(1);
  });

  it('returns 400 for invalid signature', async () => {
    const fixture = await createWebhookFixture();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount);

    await sendWebhook(body, 'sha256=invalidsignature').expect(400);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('PENDING_PAYMENT');
  });

  it('does not mark PAID when amount diverges', async () => {
    const fixture = await createWebhookFixture();
    // Send wrong amount (1 centavo instead of actual amount)
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', 1);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('PENDING_PAYMENT');
  });
});

describe('Payment webhook — PAYMENT_DECLINED', () => {
  it('marks attempt as DECLINED but leaves order PENDING_PAYMENT', async () => {
    const fixture = await createWebhookFixture();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_DECLINED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('PENDING_PAYMENT');

    const attempt = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM payment_attempts WHERE id = ${fixture.paymentAttemptId}::uuid
    `;
    expect(attempt[0]!.status).toBe('DECLINED');
  });
});

describe('Payment webhook — missing body or signature', () => {
  it('returns 400 when signature header is missing', async () => {
    const body = Buffer.from(
      JSON.stringify({ eventId: 'x', externalPaymentId: 'y', eventType: 'PAYMENT_APPROVED', amount: 100, currency: 'BRL' }),
    );
    await supertest(app.getHttpServer())
      .post('/api/v1/webhooks/payments/fake')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
  });
});

describe('Payment webhook — concurrency', () => {
  it('two simultaneous APPROVED webhooks result in order PAID exactly once', async () => {
    const fixture = await createWebhookFixture();
    const eventId = randomUUID();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount, 'BRL', eventId);
    const sig = signFakeWebhook(body);

    // Fire both requests concurrently
    const [res1, res2] = await Promise.all([
      sendWebhook(body, sig),
      sendWebhook(body, sig),
    ]);

    expect([res1.status, res2.status]).toEqual(expect.arrayContaining([200]));

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('PAID');

    // Inventory committed exactly once (2 tickets)
    const inventory = await prisma.$queryRaw<Array<{ committed: number }>>`
      SELECT committed FROM ticket_inventory WHERE ticket_type_id = ${fixture.ticketTypeId}::uuid
    `;
    expect(Number(inventory[0]!.committed)).toBe(2);
  });
});
