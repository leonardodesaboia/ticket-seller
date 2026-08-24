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
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
  await prisma.$executeRawUnsafe('DELETE FROM payment_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
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

type TicketFixture = {
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  orderId: string;
  reservationToken: string;
  paymentAttemptId: string;
  externalPaymentId: string;
  attemptAmount: number;
  quantity: number;
};

async function createTicketFixture(quantity = 2): Promise<TicketFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `ticket-${unique}@test.com`, displayName: 'Ticket Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Ticket Org', slug: `ticket-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Ticket Event',
      status: 'PUBLISHED',
      slug: `ticket-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      name: 'General',
      priceAmount: 5000,
      capacity: 100,
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
      capacity: 100,
    },
  });

  const reservationRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity }] })
    .expect(201);

  const reservationId: string = reservationRes.body.reservationId as string;
  const reservationToken: string = reservationRes.body.token as string;

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
    eventId: event.id,
    ticketTypeId: ticketType.id,
    orderId,
    reservationToken,
    paymentAttemptId,
    externalPaymentId,
    attemptAmount,
    quantity,
  };
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

async function triggerApprovedWebhook(fixture: TicketFixture, eventId = randomUUID()): Promise<void> {
  const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount, 'BRL', eventId);
  const sig = signFakeWebhook(body);
  await sendWebhook(body, sig).expect(200);
}

describe('Ticket issuance — full flow', () => {
  it('order transitions to TICKETS_ISSUED after approved webhook', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('TICKETS_ISSUED');
  });

  it('creates exactly N tickets matching quantity', async () => {
    const fixture = await createTicketFixture(3);
    await triggerApprovedWebhook(fixture);

    const tickets = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(tickets).toHaveLength(fixture.quantity);
  });

  it('GET /public/orders/:orderId/tickets returns 200 with tickets', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(200);

    expect(res.body.orderId).toBe(fixture.orderId);
    expect(res.body.tickets).toHaveLength(fixture.quantity);
  });

  it('each ticket has a 64-char hex publicCode', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(200);

    for (const ticket of res.body.tickets as Array<{ publicCode: string }>) {
      expect(ticket.publicCode).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('publicCodes are unique across tickets', async () => {
    const fixture = await createTicketFixture(4);
    await triggerApprovedWebhook(fixture);

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(200);

    const codes = (res.body.tickets as Array<{ publicCode: string }>).map((t) => t.publicCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('writes outbox events including order.tickets-issued.v1 and tickets.issued.v1', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    const events = await prisma.$queryRaw<Array<{ type: string }>>`
      SELECT type FROM outbox_events WHERE aggregate_id = ${fixture.orderId}
    `;
    const types = events.map((e) => e.type);
    expect(types).toContain('order.tickets-issued.v1');
    expect(types).toContain('tickets.issued.v1');
  });
});

describe('Ticket issuance — idempotency', () => {
  it('duplicate approved webhook does not duplicate tickets', async () => {
    const fixture = await createTicketFixture(2);
    const webhookEventId = randomUUID();

    await triggerApprovedWebhook(fixture, webhookEventId);
    await triggerApprovedWebhook(fixture, webhookEventId);

    const tickets = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(tickets).toHaveLength(fixture.quantity);
  });

  it('second approved webhook with different eventId still returns same ticket count', async () => {
    const fixture = await createTicketFixture(2);

    await triggerApprovedWebhook(fixture);
    // Second call with different eventId is deduplicated via order status check
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount);
    await sendWebhook(body, signFakeWebhook(body)).expect(200);

    const tickets = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(tickets).toHaveLength(fixture.quantity);
  });
});

describe('Ticket access — authentication', () => {
  it('GET with invalid token returns 401', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    const invalidToken = 'a'.repeat(64); // valid format but wrong token
    await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .set('x-reservation-token', invalidToken)
      .expect(401);
  });

  it('GET without token header returns 401', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .expect(401);
  });

  it('GET with malformed token (wrong length) returns 401', async () => {
    const fixture = await createTicketFixture(2);
    await triggerApprovedWebhook(fixture);

    await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .set('x-reservation-token', 'short-token')
      .expect(401);
  });
});

describe('Ticket access — before issuance', () => {
  it('GET before webhook returns empty tickets array', async () => {
    const fixture = await createTicketFixture(2);
    // No webhook triggered — order still PENDING_PAYMENT

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${fixture.orderId}/tickets`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(200);

    expect(res.body.tickets).toHaveLength(0);
  });
});

describe('Ticket issuance — concurrency', () => {
  it('two simultaneous approved webhooks produce tickets exactly once', async () => {
    const fixture = await createTicketFixture(2);
    const webhookEventId = randomUUID();
    const body = buildWebhookBody(fixture.externalPaymentId, 'PAYMENT_APPROVED', fixture.attemptAmount, 'BRL', webhookEventId);
    const sig = signFakeWebhook(body);

    const [res1, res2] = await Promise.all([
      sendWebhook(body, sig),
      sendWebhook(body, sig),
    ]);

    expect([res1.status, res2.status]).toEqual(expect.arrayContaining([200]));

    const tickets = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(tickets).toHaveLength(fixture.quantity);

    const order = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${fixture.orderId}::uuid
    `;
    expect(order[0]!.status).toBe('TICKETS_ISSUED');
  });
});
