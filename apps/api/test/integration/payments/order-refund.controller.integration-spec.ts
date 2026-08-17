import * as crypto from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
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
  await prisma.$executeRawUnsafe('DELETE FROM refund_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM payment_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_credentials');
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
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

interface RefundFixture {
  organizationId: string;
  orderId: string;
  ownerId: string;
  totalAmount: number;
}

async function createCancelledOrderWithRefundEligibility(): Promise<RefundFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `refund-${unique}@test.com`, displayName: 'Refund Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Refund Org', slug: `refund-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Refund Event',
      status: 'PUBLISHED',
      slug: `refund-event-${unique}`,
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
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] })
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
  const totalAmount = Number(attemptRows[0]!.amount);

  // Simulate APPROVED webhook → order becomes TICKETS_ISSUED
  const webhookBody = Buffer.from(
    JSON.stringify({
      eventId: `evt-approved-${unique}`,
      externalPaymentId,
      eventType: 'PAYMENT_APPROVED',
      amount: totalAmount,
      currency: 'BRL',
    }),
  );
  await supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .set('X-Fake-Signature', signFakeWebhook(webhookBody))
    .set('Content-Type', 'application/json')
    .send(webhookBody)
    .expect(200);

  // Admin-cancel the order (post-payment)
  await supertest(app.getHttpServer())
    .post(`/api/v1/organizations/${organization.id}/orders/${orderId}/cancellations`)
    .set('X-Dev-User-Id', owner.id)
    .send({ reason: 'Test cancellation' })
    .expect(200);

  return { organizationId: organization.id, orderId, ownerId: owner.id, totalAmount };
}

describe('POST /api/v1/organizations/:orgId/orders/:orderId/refunds', () => {
  it('refunds a CANCELLED order successfully', async () => {
    const { organizationId, orderId, ownerId, totalAmount } = await createCancelledOrderWithRefundEligibility();

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/orders/${orderId}/refunds`)
      .set('X-Dev-User-Id', ownerId)
      .expect(200);

    expect(res.body.status).toBe('REFUNDED');
    expect(res.body.refundedAmount).toBe(totalAmount);
    expect(res.body.currency).toBe('BRL');
    expect(res.body.externalRefundId).toMatch(/^fake_refund_/);

    // Order must be REFUNDED
    const orders = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${orderId}::uuid
    `;
    expect(orders[0]?.status).toBe('REFUNDED');

    // refund_attempt must be SUCCESS
    const refunds = await prisma.$queryRaw<Array<{ status: string; external_refund_id: string }>>`
      SELECT status, external_refund_id FROM refund_attempts WHERE order_id = ${orderId}::uuid
    `;
    expect(refunds[0]?.status).toBe('SUCCESS');
    expect(refunds[0]?.external_refund_id).toMatch(/^fake_refund_/);

    // Outbox event emitted
    const outbox = await prisma.$queryRaw<Array<{ type: string }>>`
      SELECT type FROM outbox_events WHERE aggregate_id = ${orderId} AND type = 'order.refunded.v1'
    `;
    expect(outbox.length).toBe(1);
  });

  it('returns 422 when order is not CANCELLED', async () => {
    const unique = `${Date.now()}-${++sequence}`;
    const owner = await prisma.user.create({
      data: { email: `notcancelled-${unique}@test.com`, displayName: 'Owner' },
    });
    const organization = await prisma.organization.create({
      data: { name: 'Org', slug: `org-nc-${unique}`, status: 'ACTIVE', ownerId: owner.id },
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
    });
    const event = await prisma.event.create({
      data: {
        organizationId: organization.id, title: 'Ev', status: 'PUBLISHED',
        slug: `ev-nc-${unique}`, currency: 'BRL', publishedAt: new Date(),
      },
    });
    const ticketType = await prisma.ticketType.create({
      data: { name: 'G', priceAmount: 1000, capacity: 5, eventId: event.id, organizationId: organization.id, status: 'ACTIVE' },
    });
    await prisma.ticketInventory.create({
      data: { ticketTypeId: ticketType.id, eventId: event.id, organizationId: organization.id, capacity: 5 },
    });

    const resRes = await supertest(app.getHttpServer())
      .post('/api/v1/public/reservations')
      .set('Idempotency-Key', randomUUID())
      .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] })
      .expect(201);

    const reservationToken: string = resRes.body.token as string;
    const orderRes = await supertest(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Reservation-Token', reservationToken)
      .set('Idempotency-Key', randomUUID())
      .send({ reservationId: resRes.body.reservationId })
      .expect(201);

    const orderId: string = orderRes.body.orderId as string;

    // Order is PENDING_PAYMENT — not CANCELLED
    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/orders/${orderId}/refunds`)
      .set('X-Dev-User-Id', owner.id)
      .expect(422);
  });

  it('returns 404 when order does not belong to organization', async () => {
    const unique = `${Date.now()}-${++sequence}`;
    const owner = await prisma.user.create({
      data: { email: `wrong-org-${unique}@test.com`, displayName: 'Owner' },
    });
    const wrongOrg = await prisma.organization.create({
      data: { name: 'Wrong Org', slug: `wrong-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
    });
    await prisma.organizationMember.create({
      data: { organizationId: wrongOrg.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
    });

    const { orderId } = await createCancelledOrderWithRefundEligibility();

    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${wrongOrg.id}/orders/${orderId}/refunds`)
      .set('X-Dev-User-Id', owner.id)
      .expect(404);
  });

  it('is idempotent — second call returns same refund', async () => {
    const { organizationId, orderId, ownerId } = await createCancelledOrderWithRefundEligibility();

    const res1 = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/orders/${orderId}/refunds`)
      .set('X-Dev-User-Id', ownerId)
      .expect(200);

    const res2 = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/orders/${orderId}/refunds`)
      .set('X-Dev-User-Id', ownerId)
      .expect(200);

    expect(res1.body.externalRefundId).toBe(res2.body.externalRefundId);

    // Only one refund_attempt should exist
    const refunds = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM refund_attempts WHERE order_id = ${orderId}::uuid
    `;
    expect(Number(refunds[0]?.count)).toBe(1);
  });

  it('concurrent refund calls result in exactly one SUCCESS refund', async () => {
    const { organizationId, orderId, ownerId } = await createCancelledOrderWithRefundEligibility();

    await Promise.all([
      supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/orders/${orderId}/refunds`)
        .set('X-Dev-User-Id', ownerId),
      supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/orders/${orderId}/refunds`)
        .set('X-Dev-User-Id', ownerId),
    ]);

    const orders = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${orderId}::uuid
    `;
    expect(orders[0]?.status).toBe('REFUNDED');

    const outbox = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM outbox_events WHERE aggregate_id = ${orderId} AND type = 'order.refunded.v1'
    `;
    expect(Number(outbox[0]?.count)).toBe(1);
  });
});
