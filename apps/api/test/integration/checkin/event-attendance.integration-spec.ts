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

const ACTOR_USER_ID = randomUUID();

function signFakeWebhook(body: Buffer, secret = 'fake-secret-for-dev'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
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
}, 120000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

afterEach(async () => {
  if (!prisma) return;
  await prisma.$executeRawUnsafe('DELETE FROM check_ins');
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

type AttendanceFixture = {
  organizationId: string;
  eventId: string;
  orgId: string;
  ticketId: string;
  credentialToken: string;
};

async function createAttendanceFixture(): Promise<AttendanceFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `attendance-owner-${unique}@test.com`, displayName: 'Attendance Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Attendance Org', slug: `attendance-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Attendance Event',
      status: 'PUBLISHED',
      slug: `attendance-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      name: 'Inteira',
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

  // Create reservation → order → payment → ticket
  const reservationRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] })
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

  const body = Buffer.from(
    JSON.stringify({
      eventId: randomUUID(),
      externalPaymentId,
      eventType: 'PAYMENT_APPROVED',
      amount: attemptAmount,
      currency: 'BRL',
    }),
    'utf8',
  );
  const sig = signFakeWebhook(body);
  await supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .type('json')
    .set('x-fake-signature', sig)
    .send(body.toString('utf8'))
    .expect(200);

  const ticketRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM tickets WHERE order_id = ${orderId}::uuid LIMIT 1
  `;
  const ticketId = ticketRows[0]!.id;

  const credentialRes = await supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/tickets/${ticketId}/credential`)
    .set('x-reservation-token', reservationToken)
    .expect(201);

  const credentialToken: string = credentialRes.body.credentialToken as string;

  return {
    organizationId: organization.id,
    eventId: event.id,
    orgId: organization.id,
    ticketId,
    credentialToken,
  };
}

function attendanceUrl(orgId: string, eventId: string): string {
  return `/api/v1/organizations/${orgId}/events/${eventId}/attendance`;
}

describe('EventAttendance API — authentication', () => {
  it('returns 401 without X-Dev-User-Id', async () => {
    const fixture = await createAttendanceFixture();
    await supertest(app.getHttpServer())
      .get(attendanceUrl(fixture.orgId, fixture.eventId))
      .expect(401);
  });
});

describe('EventAttendance API — event with check-ins', () => {
  it('1. returns correct metrics after a check-in is performed', async () => {
    const fixture = await createAttendanceFixture();

    // Perform check-in
    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.orgId}/events/${fixture.eventId}/check-ins`)
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    const res = await supertest(app.getHttpServer())
      .get(attendanceUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .expect(200);

    expect(res.body.totalIssued).toBe(1);
    expect(res.body.totalAdmitted).toBe(1);
    expect(res.body.totalRemaining).toBe(0);
    expect(res.body.attendanceRate).toBe(100);
    expect(res.body.byTicketType).toHaveLength(1);
    expect(res.body.byTicketType[0].ticketTypeName).toBe('Inteira');
    expect(res.body.byTicketType[0].totalAdmitted).toBe(1);
    expect(res.body.recentCheckIns).toHaveLength(1);
    expect(res.body.recentCheckIns[0].ticketTypeName).toBe('Inteira');
    expect(res.body.recentCheckIns[0].performedByUserId).toHaveLength(8);
    expect(typeof res.body.recentCheckIns[0].checkedInAt).toBe('string');
  });
});

describe('EventAttendance API — event without check-ins', () => {
  it('2. returns zeros for event with tickets but no check-ins', async () => {
    const fixture = await createAttendanceFixture();

    const res = await supertest(app.getHttpServer())
      .get(attendanceUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .expect(200);

    expect(res.body.totalIssued).toBe(1);
    expect(res.body.totalAdmitted).toBe(0);
    expect(res.body.totalRemaining).toBe(1);
    expect(res.body.attendanceRate).toBe(0);
    expect(res.body.recentCheckIns).toEqual([]);
  });
});

describe('EventAttendance API — cross-tenant guard', () => {
  it('3. returns 404 when orgId does not match the event', async () => {
    const fixture1 = await createAttendanceFixture();
    const fixture2 = await createAttendanceFixture();

    // Use fixture2's orgId with fixture1's eventId → event belongs to fixture1's org
    await supertest(app.getHttpServer())
      .get(attendanceUrl(fixture2.orgId, fixture1.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .expect(404);
  });
});
