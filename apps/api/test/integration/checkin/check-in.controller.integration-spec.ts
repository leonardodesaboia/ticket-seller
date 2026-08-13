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
  await prisma.$executeRawUnsafe('DELETE FROM check_ins');
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

type CheckInFixture = {
  organizationId: string;
  eventId: string;
  ticketId: string;
  credentialToken: string;
  orgId: string;
};

async function createCheckInFixture(eventStatus = 'PUBLISHED'): Promise<CheckInFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `checkin-owner-${unique}@test.com`, displayName: 'CheckIn Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'CheckIn Org', slug: `checkin-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'CheckIn Event',
      status: eventStatus,
      slug: `checkin-event-${unique}`,
      currency: 'BRL',
      publishedAt: eventStatus === 'PUBLISHED' ? new Date() : null,
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

  // Create reservation
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

  const attemptRows = await prisma.$queryRaw<
    Array<{ external_payment_id: string; amount: bigint }>
  >`
    SELECT external_payment_id, amount FROM payment_attempts WHERE id = ${paymentAttemptId}::uuid
  `;
  const externalPaymentId = attemptRows[0]!.external_payment_id;
  const attemptAmount = Number(attemptRows[0]!.amount);

  // Trigger approved webhook to issue tickets
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

  // Get the ticket ID
  const ticketRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM tickets WHERE order_id = ${orderId}::uuid LIMIT 1
  `;
  const ticketId = ticketRows[0]!.id;

  // Issue a credential for the ticket
  const credentialRes = await supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/tickets/${ticketId}/credential`)
    .set('x-reservation-token', reservationToken)
    .expect(201);

  const credentialToken: string = credentialRes.body.credentialToken as string;

  return {
    organizationId: organization.id,
    eventId: event.id,
    ticketId,
    credentialToken,
    orgId: organization.id,
  };
}

function checkInUrl(orgId: string, eventId: string): string {
  return `/api/v1/organizations/${orgId}/events/${eventId}/check-ins`;
}

describe('CheckIn API — authentication', () => {
  it('1. POST without X-Dev-User-Id returns 401', async () => {
    const fixture = await createCheckInFixture();
    await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .send({ credential: fixture.credentialToken })
      .expect(401);
  });
});

describe('CheckIn API — invalid credentials', () => {
  it('2. POST with non-existent credential returns 200 with INVALID_CREDENTIAL', async () => {
    const fixture = await createCheckInFixture();
    const fakeToken = 'b'.repeat(64);

    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fakeToken })
      .expect(200);

    expect(res.body.decision).toBe('INVALID_CREDENTIAL');
    expect(res.body.allowed).toBe(false);
    expect(res.body.checkedInAt).toBeNull();
  });

  it('9. Cross-tenant: orgId from another org returns INVALID_CREDENTIAL', async () => {
    const fixture1 = await createCheckInFixture();
    const fixture2 = await createCheckInFixture();

    // Use fixture1's credential but fixture2's orgId/eventId
    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture2.orgId, fixture2.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture1.credentialToken })
      .expect(200);

    expect(res.body.decision).toBe('INVALID_CREDENTIAL');
  });
});

describe('CheckIn API — wrong event', () => {
  it('3. POST with credential from another event returns WRONG_EVENT', async () => {
    const fixture1 = await createCheckInFixture();
    const fixture2 = await createCheckInFixture();

    // Use fixture1's credential but fixture2's eventId (same org would be ideal but cross-event is enough)
    // Actually need to use same org — create a second event in the same org
    const unique = `${Date.now()}-${++sequence}`;
    const owner = await prisma.user.create({
      data: { email: `wrong-event-owner-${unique}@test.com`, displayName: 'WE Owner' },
    });
    const org = await prisma.organization.create({
      data: { name: 'WE Org', slug: `we-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
    });
    const event2 = await prisma.event.create({
      data: {
        organizationId: org.id,
        title: 'Event 2',
        status: 'PUBLISHED',
        slug: `we-event2-${unique}`,
        currency: 'BRL',
        publishedAt: new Date(),
      },
    });

    // Make the credential belong to org and event1, but scan at event2's org
    // Use fixture1's credential at a different eventId (fixture2's event works if same org)
    // Simpler: scan fixture1's credential at fixture2's event (different org → INVALID_CREDENTIAL)
    // For WRONG_EVENT we need the same org, different event.
    // Use fixture1 cred at fixture2 event (different org = INVALID_CREDENTIAL, not WRONG_EVENT).
    // Let's do it properly with same org.

    // Create ticket type + inventory in fixture1's org for a second event
    const unique2 = `${Date.now()}-${++sequence}`;
    const event3 = await prisma.event.create({
      data: {
        organizationId: fixture1.orgId,
        title: 'CheckIn Event3',
        status: 'PUBLISHED',
        slug: `checkin-event3-${unique2}`,
        currency: 'BRL',
        publishedAt: new Date(),
      },
    });

    // Scan fixture1's credential at event3 (same org, different event)
    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture1.orgId, event3.id))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture1.credentialToken })
      .expect(200);

    expect(res.body.decision).toBe('WRONG_EVENT');
    expect(res.body.allowed).toBe(false);

    // Suppress unused variable warnings
    void fixture2;
    void org;
    void event2;
  });
});

describe('CheckIn API — event not active', () => {
  it('4. POST at non-published event returns EVENT_NOT_ACTIVE', async () => {
    // Create fixture with PUBLISHED event, then demote to DRAFT before check-in
    const fixture = await createCheckInFixture('PUBLISHED');

    // Demote the event to DRAFT so check-in policy returns EVENT_NOT_ACTIVE
    await prisma.$executeRawUnsafe(
      `UPDATE events SET status = 'DRAFT' WHERE id = '${fixture.eventId}'`,
    );

    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    expect(res.body.decision).toBe('EVENT_NOT_ACTIVE');
    expect(res.body.allowed).toBe(false);
  });
});

describe('CheckIn API — happy path', () => {
  it('5. POST valid credential returns 200 ADMITTED', async () => {
    const fixture = await createCheckInFixture();

    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    expect(res.body.decision).toBe('ADMITTED');
    expect(res.body.allowed).toBe(true);
    expect(res.body.checkedInAt).toBeTruthy();
    expect(typeof res.body.checkedInAt).toBe('string');
  });

  it('6. POST same ticket after ADMITTED returns ALREADY_CHECKED_IN', async () => {
    const fixture = await createCheckInFixture();

    await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    expect(res.body.decision).toBe('ALREADY_CHECKED_IN');
    expect(res.body.allowed).toBe(false);
  });
});

describe('CheckIn API — concurrency', () => {
  it('7. Two simultaneous POSTs: one ADMITTED, one ALREADY_CHECKED_IN', async () => {
    const fixture = await createCheckInFixture();

    const [res1, res2] = await Promise.all([
      supertest(app.getHttpServer())
        .post(checkInUrl(fixture.orgId, fixture.eventId))
        .set('X-Dev-User-Id', ACTOR_USER_ID)
        .send({ credential: fixture.credentialToken }),
      supertest(app.getHttpServer())
        .post(checkInUrl(fixture.orgId, fixture.eventId))
        .set('X-Dev-User-Id', ACTOR_USER_ID)
        .send({ credential: fixture.credentialToken }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const decisions = [res1.body.decision as string, res2.body.decision as string];
    expect(decisions).toContain('ADMITTED');
    expect(decisions).toContain('ALREADY_CHECKED_IN');

    // Exactly one ADMITTED in DB (partial unique index guarantees it)
    const admittedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM check_ins
      WHERE ticket_id = ${fixture.ticketId}::uuid AND result = 'ADMITTED'
    `;
    expect(Number(admittedCount[0]!.count)).toBe(1);
  });
});

describe('CheckIn API — idempotency', () => {
  it('8. Same Idempotency-Key returns same result without new check-in row', async () => {
    const fixture = await createCheckInFixture();
    const idempotencyKey = randomUUID();

    const res1 = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .set('Idempotency-Key', idempotencyKey)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    const res2 = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .set('Idempotency-Key', idempotencyKey)
      .send({ credential: fixture.credentialToken })
      .expect(200);

    // Same result
    expect(res1.body.decision).toBe(res2.body.decision);
    expect(res1.body.allowed).toBe(res2.body.allowed);

    // Only one check_in row with this key
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM check_ins WHERE idempotency_key = ${idempotencyKey}
    `;
    expect(Number(rows[0]!.count)).toBe(1);
  });
});

describe('CheckIn API — response fields', () => {
  it('10. Response does not contain sensitive internal fields', async () => {
    const fixture = await createCheckInFixture();
    const fakeToken = 'c'.repeat(64);

    const res = await supertest(app.getHttpServer())
      .post(checkInUrl(fixture.orgId, fixture.eventId))
      .set('X-Dev-User-Id', ACTOR_USER_ID)
      .send({ credential: fakeToken })
      .expect(200);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('tokenHash');
    expect(bodyStr).not.toContain('token_hash');
    expect(bodyStr).not.toContain('credentialId');
    expect(bodyStr).not.toContain('credential_id');
    expect(bodyStr).not.toContain('orderId');
    expect(bodyStr).not.toContain('order_id');
    expect(bodyStr).not.toContain('ticketId');
    expect(bodyStr).not.toContain('ticket_id');
  });
});
