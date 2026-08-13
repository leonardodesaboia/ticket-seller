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
  await prisma.$executeRawUnsafe('DELETE FROM ticket_transfers');
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

type TransferFixture = {
  organizationId: string;
  eventId: string;
  orderId: string;
  reservationToken: string;
  ticketId: string;
};

async function createTransferFixture(): Promise<TransferFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `transfer-${unique}@test.com`, displayName: 'Transfer Owner' },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Transfer Org', slug: `transfer-org-${unique}`, status: 'ACTIVE', ownerId: owner.id },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Transfer Event',
      status: 'PUBLISHED',
      slug: `transfer-event-${unique}`,
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
    orderId,
    reservationToken,
    ticketId,
  };
}

describe('Transfer API — initiate', () => {
  it('POST returns 201 with claimToken and expiresAt', async () => {
    const fixture = await createTransferFixture();

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    expect(res.body.claimToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.expiresAt).toBeDefined();
    expect(new Date(res.body.expiresAt as string).getTime()).toBeGreaterThan(Date.now());

    // Verify claim_token_hash is not in response
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('claim_token_hash');
    expect(bodyStr).not.toContain('claimTokenHash');
  });

  it('POST with ADMITTED ticket returns 409 TICKET_ALREADY_ADMITTED', async () => {
    const fixture = await createTransferFixture();

    // Issue a credential first so check-in has something to reference
    const credRes = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/credential`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    // Manually insert an ADMITTED check-in
    const credentialRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM ticket_credentials WHERE ticket_id = ${fixture.ticketId}::uuid AND status = 'ACTIVE'
    `;
    const credentialId = credentialRows[0]!.id;

    await prisma.$executeRaw`
      INSERT INTO check_ins (id, organization_id, event_id, ticket_id, credential_id, result, source)
      VALUES (
        gen_random_uuid(),
        ${fixture.organizationId}::uuid,
        ${fixture.eventId}::uuid,
        ${fixture.ticketId}::uuid,
        ${credentialId}::uuid,
        'ADMITTED',
        'SCANNER'
      )
    `;

    // Suppress unused variable warning
    void credRes;

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(409);

    expect(res.body.code).toBe('TICKET_ALREADY_ADMITTED');
  });

  it('POST twice returns 409 TRANSFER_ALREADY_PENDING on second call', async () => {
    const fixture = await createTransferFixture();

    await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(409);

    expect(res.body.code).toBe('TRANSFER_ALREADY_PENDING');
  });
});

describe('Transfer API — cancel', () => {
  it('DELETE returns 204 when pending transfer exists', async () => {
    const fixture = await createTransferFixture();

    // Initiate first
    await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    // Cancel
    await supertest(app.getHttpServer())
      .delete(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(204);

    // Verify status in DB
    const rows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM ticket_transfers WHERE ticket_id = ${fixture.ticketId}::uuid
    `;
    expect(rows[0]!.status).toBe('CANCELLED');
  });

  it('DELETE without pending transfer returns 404', async () => {
    const fixture = await createTransferFixture();

    const res = await supertest(app.getHttpServer())
      .delete(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(404);

    expect(res.body.code).toBe('TRANSFER_NOT_FOUND');
  });
});

describe('Transfer API — accept', () => {
  it('POST accept returns 200 with newCredentialToken', async () => {
    const fixture = await createTransferFixture();

    // Initiate transfer
    const initRes = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const claimToken: string = initRes.body.claimToken as string;

    // Accept transfer
    const acceptRes = await supertest(app.getHttpServer())
      .post(`/api/v1/public/transfers/${claimToken}/accept`)
      .expect(200);

    expect(acceptRes.body.newCredentialToken).toMatch(/^[0-9a-f]{64}$/);

    // Verify transfer is now ACCEPTED in DB
    const rows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM ticket_transfers WHERE ticket_id = ${fixture.ticketId}::uuid
    `;
    expect(rows[0]!.status).toBe('ACCEPTED');

    // Verify new credential is active
    const credRows = await prisma.$queryRaw<Array<{ status: string; token_hash: string }>>`
      SELECT status, token_hash FROM ticket_credentials
      WHERE ticket_id = ${fixture.ticketId}::uuid AND status = 'ACTIVE'
    `;
    expect(credRows).toHaveLength(1);
    const expectedHash = crypto
      .createHash('sha256')
      .update(acceptRes.body.newCredentialToken as string)
      .digest('hex');
    expect(credRows[0]!.token_hash).toBe(expectedHash);
  });

  it('POST accept with expired token returns 400 TRANSFER_EXPIRED', async () => {
    const fixture = await createTransferFixture();

    // Initiate transfer
    const initRes = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const claimToken: string = initRes.body.claimToken as string;

    // Manually expire the transfer
    await prisma.$executeRaw`
      UPDATE ticket_transfers
      SET expires_at = NOW() - INTERVAL '1 second'
      WHERE ticket_id = ${fixture.ticketId}::uuid
    `;

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/transfers/${claimToken}/accept`)
      .expect(400);

    expect(res.body.code).toBe('TRANSFER_EXPIRED');
  });

  it('POST accept with invalid token returns 404', async () => {
    const fakeToken = 'f'.repeat(64);
    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/public/transfers/${fakeToken}/accept`)
      .expect(404);

    expect(res.body.code).toBe('TRANSFER_NOT_FOUND');
  });

  it('POST accept concurrently — exactly one succeeds, other returns 409', async () => {
    const fixture = await createTransferFixture();

    // Initiate transfer
    const initRes = await supertest(app.getHttpServer())
      .post(`/api/v1/public/orders/${fixture.orderId}/tickets/${fixture.ticketId}/transfer`)
      .set('x-reservation-token', fixture.reservationToken)
      .expect(201);

    const claimToken: string = initRes.body.claimToken as string;

    // Two concurrent accepts
    const [res1, res2] = await Promise.all([
      supertest(app.getHttpServer())
        .post(`/api/v1/public/transfers/${claimToken}/accept`),
      supertest(app.getHttpServer())
        .post(`/api/v1/public/transfers/${claimToken}/accept`),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const successRes = res1.status === 200 ? res1 : res2;
    const failRes = res1.status === 409 ? res1 : res2;

    expect(successRes.body.newCredentialToken).toMatch(/^[0-9a-f]{64}$/);
    expect(failRes.body.code).toBe('TRANSFER_ALREADY_ACCEPTED');

    // Only one ACTIVE credential in DB
    const credRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM ticket_credentials
      WHERE ticket_id = ${fixture.ticketId}::uuid AND status = 'ACTIVE'
    `;
    expect(credRows).toHaveLength(1);

    // Transfer is ACCEPTED
    const transferRows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM ticket_transfers WHERE ticket_id = ${fixture.ticketId}::uuid
    `;
    expect(transferRows[0]!.status).toBe('ACCEPTED');
  });
});
