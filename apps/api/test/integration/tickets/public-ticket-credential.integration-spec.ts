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

type CredentialFixture = {
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  orderId: string;
  reservationToken: string;
  ticketId: string;
};

async function createCredentialFixture(): Promise<CredentialFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `cred-${unique}@test.com`, displayName: 'Cred Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Cred Org', slug: `cred-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Cred Event',
      status: 'PUBLISHED',
      slug: `cred-event-${unique}`,
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

  return {
    organizationId: organization.id,
    eventId: event.id,
    ticketTypeId: ticketType.id,
    orderId,
    reservationToken,
    ticketId,
  };
}

describe('Credential API — authentication', () => {
  it('POST without token returns 401', async () => {
    const fixture = await createCredentialFixture();
    await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .expect(401);
  });

  it('POST with invalid token (wrong value) returns 401', async () => {
    const fixture = await createCredentialFixture();
    await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', 'a'.repeat(64))
      .expect(401);
  });

  it('POST with valid format token but belonging to a different order returns 401', async () => {
    const fixture = await createCredentialFixture();
    const otherFixture = await createCredentialFixture();
    await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', otherFixture.reservationToken)
      .expect(401);
  });
});

describe('Credential API — ticket state validation', () => {
  it('POST for a cancelled ticket returns 409', async () => {
    const fixture = await createCredentialFixture();

    // Manually cancel the ticket — cancelled_at required by tickets_cancelled_consistency check constraint.
    await prisma.$executeRawUnsafe(
      `UPDATE tickets SET status = 'CANCELLED', cancelled_at = now() WHERE id = '${fixture.ticketId}'`,
    );

    await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(409);
  });
});

describe('Credential API — happy path', () => {
  it('POST returns 201 with 64-hex credentialToken that is not the tokenHash', async () => {
    const fixture = await createCredentialFixture();

    const res = await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    expect(res.body.credentialToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.ticketId).toBe(fixture.ticketId);
    expect(res.body.version).toBe(1);

    // Verify the token hash is in the DB but not in the response
    const tokenHash = crypto
      .createHash('sha256')
      .update(res.body.credentialToken as string)
      .digest('hex');
    const dbRows = await prisma.$queryRaw<Array<{ token_hash: string }>>`
      SELECT token_hash FROM ticket_credentials WHERE ticket_id = ${fixture.ticketId}::uuid
    `;
    expect(dbRows[0]!.token_hash).toBe(tokenHash);
    expect(res.body).not.toHaveProperty('tokenHash');
    expect(res.body).not.toHaveProperty('token_hash');
    expect(res.body.credentialToken).not.toBe(tokenHash);
  });

  it('POST twice on same ticket revokes first credential and issues new one (version bumps)', async () => {
    const fixture = await createCredentialFixture();

    const res1 = await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const res2 = await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    // Tokens must differ
    expect(res1.body.credentialToken).not.toBe(res2.body.credentialToken);
    // Version must be bumped
    expect(res2.body.version).toBe(2);

    // Only one ACTIVE credential
    const activeRows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM ticket_credentials
      WHERE ticket_id = ${fixture.ticketId}::uuid AND status = 'ACTIVE'
    `;
    expect(activeRows).toHaveLength(1);

    // First credential is revoked
    const allRows = await prisma.$queryRaw<Array<{ status: string; version: number }>>`
      SELECT status, version FROM ticket_credentials
      WHERE ticket_id = ${fixture.ticketId}::uuid
      ORDER BY version
    `;
    expect(allRows).toHaveLength(2);
    expect(allRows[0]!.status).toBe('REVOKED');
    expect(allRows[1]!.status).toBe('ACTIVE');
  });

  it('GET returns hasCredential=false when no credential exists', async () => {
    const fixture = await createCredentialFixture();

    const res = await supertest(app.getHttpServer())
      .get(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(200);

    expect(res.body.hasCredential).toBe(false);
    expect(res.body.ticketId).toBe(fixture.ticketId);
  });

  it('GET returns hasCredential=true after POST', async () => {
    const fixture = await createCredentialFixture();

    await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const res = await supertest(app.getHttpServer())
      .get(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(200);

    expect(res.body.hasCredential).toBe(true);
  });

  it('token_hash never appears in API responses', async () => {
    const fixture = await createCredentialFixture();

    const res = await supertest(app.getHttpServer())
      .post(
        `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
      )
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('tokenHash');
    expect(bodyStr).not.toContain('token_hash');
  });
});

describe('Credential API — concurrency', () => {
  it('two simultaneous POSTs produce only one ACTIVE credential (no duplication)', async () => {
    const fixture = await createCredentialFixture();

    // Send two concurrent POST requests
    const [res1, res2] = await Promise.all([
      supertest(app.getHttpServer())
        .post(
          `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
        )
        .set('x-reservation-token', fixture.reservationToken),
      supertest(app.getHttpServer())
        .post(
          `/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`,
        )
        .set('x-reservation-token', fixture.reservationToken),
    ]);

    // Both should succeed (201)
    expect([res1.status, res2.status]).toEqual(expect.arrayContaining([201]));
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    // Only one ACTIVE credential in the database
    const activeRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM ticket_credentials
      WHERE ticket_id = ${fixture.ticketId}::uuid AND status = 'ACTIVE'
    `;
    expect(activeRows).toHaveLength(1);
  });
});
