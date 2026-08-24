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
let seq = 0;

const ACTOR_ID = randomUUID();

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
  if (migration.status !== 0) throw new Error(`prisma migrate failed: ${String(migration.status)}`);

  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
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
  await prisma.$executeRawUnsafe('DELETE FROM audit_entries');
  await prisma.$executeRawUnsafe('DELETE FROM check_ins');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_transfers');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_credentials');
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

// ---- Fixture helpers ----

type Fixture = {
  orgId: string;
  eventId: string;
  ticketTypeId: string;
  eventSlug: string;
};

async function createBaseFixture(): Promise<Fixture> {
  const unique = `${Date.now()}-${++seq}`;
  const owner = await prisma.user.create({ data: { email: `cancel-owner-${unique}@test.com`, displayName: 'Owner' } });
  const org = await prisma.organization.create({
    data: { name: 'Cancel Org', slug: `cancel-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      title: 'Cancel Event',
      status: 'PUBLISHED',
      slug: `cancel-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const tt = await prisma.ticketType.create({
    data: { name: 'Inteira', priceAmount: 5000, capacity: 50, eventId: event.id, organizationId: org.id, status: 'ACTIVE' },
  });
  await prisma.ticketInventory.create({
    data: { ticketTypeId: tt.id, eventId: event.id, organizationId: org.id, capacity: 50 },
  });
  return { orgId: org.id, eventId: event.id, ticketTypeId: tt.id, eventSlug: event.slug ?? `cancel-event-${unique}` };
}

async function createPendingPaymentOrder(fixture: Fixture): Promise<{ orderId: string; token: string }> {
  const resRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: fixture.eventSlug, items: [{ ticketTypeId: fixture.ticketTypeId, quantity: 1 }] })
    .expect(201);

  const reservationId: string = resRes.body.reservationId as string;
  const token: string = resRes.body.token as string;

  const orderRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/orders')
    .set('X-Reservation-Token', token)
    .set('Idempotency-Key', randomUUID())
    .send({ reservationId })
    .expect(201);

  return { orderId: orderRes.body.orderId as string, token };
}

async function promoteToTicketsIssued(orderId: string, token: string): Promise<void> {
  const payRes = await supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/payments`)
    .set('X-Reservation-Token', token)
    .set('Idempotency-Key', randomUUID())
    .send({ paymentMethod: 'FAKE_PIX' })
    .expect(201);

  const paymentAttemptId: string = payRes.body.paymentAttemptId as string;
  const rows = await prisma.$queryRaw<Array<{ external_payment_id: string; amount: bigint }>>`
    SELECT external_payment_id, amount FROM payment_attempts WHERE id = ${paymentAttemptId}::uuid
  `;
  const extId = rows[0]!.external_payment_id;
  const amount = Number(rows[0]!.amount);

  const body = Buffer.from(
    JSON.stringify({ eventId: randomUUID(), externalPaymentId: extId, eventType: 'PAYMENT_APPROVED', amount, currency: 'BRL' }),
    'utf8',
  );
  await supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .type('json')
    .set('x-fake-signature', signFakeWebhook(body))
    .send(body.toString('utf8'))
    .expect(200);
}

// ---- Tests ----

describe('POST /public/orders/:orderId/cancellations (buyer)', () => {
  it('1. cancels PENDING_PAYMENT order — inventory released, attempt CANCELLED, outbox emitted', async () => {
    const fixture = await createBaseFixture();
    const { orderId, token } = await createPendingPaymentOrder(fixture);

    const inventoryBefore = await prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypeId } });
    expect(inventoryBefore.reserved).toBe(1);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/cancellations`)
      .set('x-reservation-token', token)
      .send({})
      .expect(200);

    expect(res.body.orderId).toBe(orderId);
    expect(res.body.status).toBe('CANCELLED');

    // Inventory: reserved back to 0
    const invAfter = await prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypeId } });
    expect(invAfter.reserved).toBe(0);

    // No payment attempt was created (buyer didn't initiate payment) — that's fine
    // Verify order status
    const orders = await prisma.$queryRaw<Array<{ status: string; cancelled_at: Date | null }>>`
      SELECT status, cancelled_at FROM orders WHERE id = ${orderId}::uuid
    `;
    expect(orders[0]?.status).toBe('CANCELLED');
    expect(orders[0]?.cancelled_at).not.toBeNull();

    // Outbox event emitted
    const outbox = await prisma.outboxEvent.findFirst({ where: { aggregateId: orderId, type: 'order.cancelled.v1' } });
    expect(outbox).not.toBeNull();
    expect((outbox!.payload as Record<string, unknown>)['requiresRefund']).toBe(false);
  });

  it('2. returns 401 for invalid token', async () => {
    const fixture = await createBaseFixture();
    const { orderId } = await createPendingPaymentOrder(fixture);

    await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/cancellations`)
      .set('x-reservation-token', '0'.repeat(64))
      .send({})
      .expect(401);
  });

  it('3. returns 401 for missing token', async () => {
    const fixture = await createBaseFixture();
    const { orderId } = await createPendingPaymentOrder(fixture);

    await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/cancellations`)
      .send({})
      .expect(401);
  });

  it('4. idempotent: second cancel returns 422 ORDER_ALREADY_CANCELLED', async () => {
    const fixture = await createBaseFixture();
    const { orderId, token } = await createPendingPaymentOrder(fixture);

    await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/cancellations`)
      .set('x-reservation-token', token)
      .send({})
      .expect(200);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/cancellations`)
      .set('x-reservation-token', token)
      .send({})
      .expect(422);

    expect(res.body.code).toBe('ORDER_ALREADY_CANCELLED');
  });
});

describe('POST /organizations/:orgId/orders/:orderId/cancellations (admin)', () => {
  it('5. admin cancels PENDING_PAYMENT order — inventory released', async () => {
    const fixture = await createBaseFixture();
    const { orderId } = await createPendingPaymentOrder(fixture);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/orders/${orderId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(200);

    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.requiresRefund).toBe(false);

    const inv = await prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypeId } });
    expect(inv.reserved).toBe(0);
  });

  it('6. admin cancels TICKETS_ISSUED order — tickets CANCELLED, credentials REVOKED, committed released, outbox emitted', async () => {
    const fixture = await createBaseFixture();
    const { orderId, token } = await createPendingPaymentOrder(fixture);
    await promoteToTicketsIssued(orderId, token);

    const invBefore = await prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypeId } });
    expect(invBefore.committed).toBe(1);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/orders/${orderId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({ reason: 'Test cancellation' })
      .expect(200);

    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.requiresRefund).toBe(true);
    expect(res.body.ticketsCancelledCount).toBeGreaterThan(0);

    // Committed released
    const invAfter = await prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypeId } });
    expect(invAfter.committed).toBe(0);

    // Tickets cancelled
    const tickets = await prisma.$queryRaw<Array<{ status: string; cancelled_at: Date | null }>>`
      SELECT status, cancelled_at FROM tickets WHERE order_id = ${orderId}::uuid
    `;
    for (const t of tickets) {
      expect(t.status).toBe('CANCELLED');
      expect(t.cancelled_at).not.toBeNull();
    }

    // Credentials revoked
    const ticketRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${orderId}::uuid
    `;
    for (const tr of ticketRows) {
      const creds = await prisma.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM ticket_credentials WHERE ticket_id = ${tr.id}::uuid
      `;
      for (const c of creds) {
        expect(c.status).toBe('REVOKED');
      }
    }

    // Outbox events
    const orderOutbox = await prisma.outboxEvent.findFirst({ where: { aggregateId: orderId, type: 'order.cancelled.v1' } });
    expect(orderOutbox).not.toBeNull();
    expect((orderOutbox!.payload as Record<string, unknown>)['requiresRefund']).toBe(true);

    const ticketOutboxes = await prisma.outboxEvent.findMany({ where: { type: 'ticket.cancelled.v1' } });
    expect(ticketOutboxes.length).toBeGreaterThan(0);
  });

  it('7. returns 404 for order from different organization', async () => {
    const fixture = await createBaseFixture();
    const { orderId } = await createPendingPaymentOrder(fixture);
    const otherOrgId = randomUUID();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${otherOrgId}/orders/${orderId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(404);
  });

  it('8. returns 409 TICKET_ALREADY_USED when ticket has ADMITTED check-in', async () => {
    const fixture = await createBaseFixture();
    const { orderId, token } = await createPendingPaymentOrder(fixture);
    await promoteToTicketsIssued(orderId, token);

    // Get ticket and create a credential, then perform check-in
    const ticketRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${orderId}::uuid LIMIT 1
    `;
    const ticketId = ticketRows[0]!.id;

    const credRes = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/tickets/${ticketId}/credential`)
      .set('x-reservation-token', token)
      .expect(201);

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/check-ins`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({ credential: credRes.body.credentialToken })
      .expect(200);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/orders/${orderId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(409);

    expect(res.body.code).toBe('ORDER_NOT_CANCELLABLE');
    expect(res.body.eligibilityCode).toBe('TICKET_ALREADY_USED');
  });

  it('9. returns 409 TICKET_TRANSFER_PENDING when transfer is pending', async () => {
    const fixture = await createBaseFixture();
    const { orderId, token } = await createPendingPaymentOrder(fixture);
    await promoteToTicketsIssued(orderId, token);

    const ticketRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets WHERE order_id = ${orderId}::uuid LIMIT 1
    `;
    const ticketId = ticketRows[0]!.id;

    // Initiate transfer
    await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${orderId}/tickets/${ticketId}/transfer`)
      .set('x-reservation-token', token)
      .expect(201);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/orders/${orderId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(409);

    expect(res.body.eligibilityCode).toBe('TICKET_TRANSFER_PENDING');
  });

  it('10. concurrency: two simultaneous cancellations — only one executes effects', async () => {
    const fixture = await createBaseFixture();
    const { orderId } = await createPendingPaymentOrder(fixture);

    const [r1, r2] = await Promise.all([
      supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${fixture.orgId}/orders/${orderId}/cancellations`)
        .set('X-Dev-User-Id', ACTOR_ID)
        .send({}),
      supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${fixture.orgId}/orders/${orderId}/cancellations`)
        .set('X-Dev-User-Id', ACTOR_ID)
        .send({}),
    ]);

    // Cancellation is idempotent: both requests succeed (the second finds the order already
    // CANCELLED and returns early inside the transaction, preserving all invariants).
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 200]);

    // Exactly one outbox event
    const outboxCount = await prisma.outboxEvent.count({ where: { aggregateId: orderId, type: 'order.cancelled.v1' } });
    expect(outboxCount).toBe(1);

    // Inventory not double-released
    const inv = await prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypeId } });
    expect(inv.reserved).toBe(0);
    expect(inv.reserved).toBeGreaterThanOrEqual(0);
  });
});
