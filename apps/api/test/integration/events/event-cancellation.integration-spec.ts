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

  // NOTE: TASK-041 introduced a DI bug in NotificationsInfrastructureModule where OutboxNotificationWorker
  // injects SendEmailUseCase but that use-case is only provided in the outer NotificationsModule, not
  // in NotificationsInfrastructureModule. This causes AppModule compilation to fail in tests.
  // Fix: move OutboxNotificationWorker to NotificationsModule (outside our scope — TASK-041 infra files).
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

// ---- Fixture helpers ----

type Fixture = {
  orgId: string;
  eventId: string;
  ticketTypeId: string;
  eventSlug: string;
};

async function createBaseFixture(): Promise<Fixture> {
  const unique = `${Date.now()}-${++seq}`;
  const owner = await prisma.user.create({
    data: { email: `cancel-event-owner-${unique}@test.com`, displayName: 'Owner' },
  });
  const org = await prisma.organization.create({
    data: { name: 'Cancel Event Org', slug: `cancel-event-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      title: 'Cancel Event Test',
      status: 'PUBLISHED',
      slug: `cancel-event-test-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const tt = await prisma.ticketType.create({
    data: {
      name: 'Inteira',
      priceAmount: 5000,
      capacity: 50,
      eventId: event.id,
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });
  await prisma.ticketInventory.create({
    data: { ticketTypeId: tt.id, eventId: event.id, organizationId: org.id, capacity: 50 },
  });
  return {
    orgId: org.id,
    eventId: event.id,
    ticketTypeId: tt.id,
    eventSlug: event.slug ?? `cancel-event-test-${unique}`,
  };
}

async function createPendingPaymentOrder(
  fixture: Fixture,
): Promise<{ orderId: string; token: string }> {
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
    JSON.stringify({
      eventId: randomUUID(),
      externalPaymentId: extId,
      eventType: 'PAYMENT_APPROVED',
      amount,
      currency: 'BRL',
    }),
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

describe('POST /organizations/:orgId/events/:eventId/cancellations (event cancellation)', () => {
  it('1. cancels PUBLISHED event — response has correct shape', async () => {
    const fixture = await createBaseFixture();

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({ reason: 'Venue unavailable' })
      .expect(200);

    expect(res.body.eventId).toBe(fixture.eventId);
    expect(res.body.organizationId).toBe(fixture.orgId);
    expect(res.body.status).toBe('CANCELLED');
    expect(typeof res.body.cancelledAt).toBe('string');
    expect(typeof res.body.ordersCancelledCount).toBe('number');
  });

  it('2. event status becomes CANCELLED in database', async () => {
    const fixture = await createBaseFixture();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(200);

    const rows = await prisma.$queryRaw<Array<{ status: string; cancelled_at: Date | null }>>`
      SELECT status, cancelled_at FROM events WHERE id = ${fixture.eventId}::uuid
    `;
    expect(rows[0]?.status).toBe('CANCELLED');
    expect(rows[0]?.cancelled_at).not.toBeNull();
  });

  it('3. cancels event with TICKETS_ISSUED orders — orders CANCELLED, outbox emitted with requiresRefund=true', async () => {
    const fixture = await createBaseFixture();
    const { orderId, token } = await createPendingPaymentOrder(fixture);
    await promoteToTicketsIssued(orderId, token);

    const invBefore = await prisma.ticketInventory.findUniqueOrThrow({
      where: { ticketTypeId: fixture.ticketTypeId },
    });
    expect(invBefore.committed).toBe(1);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({ reason: 'Event cancelled' })
      .expect(200);

    expect(res.body.ordersCancelledCount).toBe(1);

    // Order is cancelled
    const orderRows = await prisma.$queryRaw<Array<{ status: string; cancelled_at: Date | null }>>`
      SELECT status, cancelled_at FROM orders WHERE id = ${orderId}::uuid
    `;
    expect(orderRows[0]?.status).toBe('CANCELLED');
    expect(orderRows[0]?.cancelled_at).not.toBeNull();

    // Committed inventory released
    const invAfter = await prisma.ticketInventory.findUniqueOrThrow({
      where: { ticketTypeId: fixture.ticketTypeId },
    });
    expect(invAfter.committed).toBe(0);

    // Tickets cancelled
    const ticketRows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM tickets WHERE order_id = ${orderId}::uuid
    `;
    for (const t of ticketRows) {
      expect(t.status).toBe('CANCELLED');
    }

    // Outbox order.cancelled.v1 with requiresRefund=true
    const orderOutbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: orderId, type: 'order.cancelled.v1' },
    });
    expect(orderOutbox).not.toBeNull();
    expect((orderOutbox!.payload as Record<string, unknown>)['requiresRefund']).toBe(true);

    // Outbox event.cancelled.v1
    const eventOutbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: fixture.eventId, type: 'event.cancelled.v1' },
    });
    expect(eventOutbox).not.toBeNull();
  });

  it('4. cancels event with PENDING_PAYMENT orders — requiresRefund=false, inventory released', async () => {
    const fixture = await createBaseFixture();
    const { orderId } = await createPendingPaymentOrder(fixture);

    const invBefore = await prisma.ticketInventory.findUniqueOrThrow({
      where: { ticketTypeId: fixture.ticketTypeId },
    });
    expect(invBefore.reserved).toBe(1);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(200);

    expect(res.body.ordersCancelledCount).toBe(1);

    // Reserved inventory released
    const invAfter = await prisma.ticketInventory.findUniqueOrThrow({
      where: { ticketTypeId: fixture.ticketTypeId },
    });
    expect(invAfter.reserved).toBe(0);

    // Outbox with requiresRefund=false
    const orderOutbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: orderId, type: 'order.cancelled.v1' },
    });
    expect(orderOutbox).not.toBeNull();
    expect((orderOutbox!.payload as Record<string, unknown>)['requiresRefund']).toBe(false);
  });

  it('5. idempotency: second cancellation of already-CANCELLED event returns 422', async () => {
    const fixture = await createBaseFixture();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(200);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(422);

    expect(res.body.code).toBe('EVENT_ALREADY_CANCELLED');
  });

  it('6. returns 404 when event does not exist', async () => {
    const fixture = await createBaseFixture();
    const nonExistentEventId = randomUUID();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${nonExistentEventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(404);
  });

  it('7. returns 404 when event belongs to different organization', async () => {
    const fixture = await createBaseFixture();
    const otherOrgId = randomUUID();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${otherOrgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(404);
  });

  it('8. event.cancelled.v1 outbox event is emitted', async () => {
    const fixture = await createBaseFixture();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({ reason: 'Test reason' })
      .expect(200);

    const eventOutbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: fixture.eventId, type: 'event.cancelled.v1' },
    });
    expect(eventOutbox).not.toBeNull();
    expect((eventOutbox!.payload as Record<string, unknown>)['eventId']).toBe(fixture.eventId);
    expect((eventOutbox!.payload as Record<string, unknown>)['organizationId']).toBe(fixture.orgId);
  });

  it('9. audit entry is created when actorId provided', async () => {
    const fixture = await createBaseFixture();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(200);

    const audit = await prisma.$queryRaw<Array<{ action: string; resource_type: string }>>`
      SELECT action, resource_type FROM audit_entries
      WHERE resource_id = ${fixture.eventId}
        AND action = 'event.cancelled'
    `;
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0]?.resource_type).toBe('event');
  });

  it('10. cancellation with no orders — ordersCancelledCount is 0 and event is still CANCELLED', async () => {
    const fixture = await createBaseFixture();

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/cancellations`)
      .set('X-Dev-User-Id', ACTOR_ID)
      .send({})
      .expect(200);

    expect(res.body.ordersCancelledCount).toBe(0);
    expect(res.body.status).toBe('CANCELLED');

    const rows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM events WHERE id = ${fixture.eventId}::uuid
    `;
    expect(rows[0]?.status).toBe('CANCELLED');
  });
});
