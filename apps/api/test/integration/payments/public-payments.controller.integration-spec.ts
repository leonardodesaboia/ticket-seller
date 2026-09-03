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

type EventFixture = {
  organizationId: string;
  slug: string;
  ticketTypes: Array<{ id: string; name: string; priceAmount: number; capacity: number }>;
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const databaseUrl = container.getConnectionUri();
  process.env['DATABASE_URL'] = databaseUrl;

  const migration = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' },
  );
  if (migration.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(migration.status)}`);
  }

  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
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

async function createEventFixture(
  input: {
    ticketTypes?: Array<{ name: string; priceAmount: number; capacity: number }>;
  } = {},
): Promise<EventFixture> {
  const unique = `${Date.now()}-${++sequence}`;
  const owner = await prisma.user.create({
    data: { email: `payment-${unique}@test.com`, displayName: 'Payment Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Payment Organization',
      slug: `payment-org-${unique}`,
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
      title: 'Payment Event',
      status: 'PUBLISHED',
      slug: `payment-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const ticketTypes = await Promise.all(
    (input.ticketTypes ?? [{ name: 'General', priceAmount: 5000, capacity: 10 }]).map(
      async (ticketType) => {
        const created = await prisma.ticketType.create({
          data: {
            ...ticketType,
            eventId: event.id,
            organizationId: organization.id,
            status: 'ACTIVE',
          },
        });
        await prisma.ticketInventory.create({
          data: {
            ticketTypeId: created.id,
            eventId: event.id,
            organizationId: organization.id,
            capacity: ticketType.capacity,
          },
        });
        return { id: created.id, ...ticketType };
      },
    ),
  );
  return { organizationId: organization.id, slug: event.slug!, ticketTypes };
}

function createReservation(
  fixture: EventFixture,
  items: Array<{ ticketTypeId: string; quantity: number }>,
) {
  return supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: fixture.slug, items });
}

function createOrder(reservationId: string, token: string, idempotencyKey = randomUUID()) {
  return supertest(app.getHttpServer())
    .post('/api/v1/public/orders')
    .set('X-Reservation-Token', token)
    .set('Idempotency-Key', idempotencyKey)
    .send({ reservationId });
}

function createPayment(
  orderId: string,
  token: string,
  paymentMethod: string,
  idempotencyKey = randomUUID(),
) {
  return supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/payments`)
    .set('X-Reservation-Token', token)
    .set('Idempotency-Key', idempotencyKey)
    .send({ paymentMethod });
}

function getLatestPayment(orderId: string, token: string) {
  return supertest(app.getHttpServer())
    .get(`/api/v1/public/orders/${orderId}/payments/latest`)
    .set('X-Reservation-Token', token);
}

describe('Public payments API', () => {
  it('creates a PENDING payment attempt with FAKE_PIX checkoutData', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const response = await createPayment(order.body.orderId, reservation.body.token, 'FAKE_PIX').expect(201);

    expect(response.body).toMatchObject({
      orderId: order.body.orderId,
      provider: 'FAKE',
      status: 'PENDING',
      paymentMethod: 'FAKE_PIX',
      currency: 'BRL',
    });
    expect(response.body.paymentAttemptId).toEqual(expect.any(String));
    expect(response.body.checkoutData).toMatchObject({ type: 'PIX' });
    expect(response.body.expiresAt).toEqual(expect.any(String));
  });

  it('creates a PENDING payment attempt with FAKE_CREDIT_CARD checkoutData', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const response = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_CREDIT_CARD',
    ).expect(201);

    expect(response.body).toMatchObject({
      status: 'PENDING',
      paymentMethod: 'FAKE_CREDIT_CARD',
    });
    expect(response.body.checkoutData).toMatchObject({ type: 'CREDIT_CARD' });
  });

  it('returns 404 for non-existent order', async () => {
    const fakeOrderId = randomUUID();
    const fakeToken = 'a'.repeat(64);
    const response = await createPayment(fakeOrderId, fakeToken, 'FAKE_PIX').expect(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 401 for invalid reservation token', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const response = await createPayment(order.body.orderId, 'f'.repeat(64), 'FAKE_PIX').expect(401);
    expect(response.body.code).toBe('INVALID_RESERVATION_TOKEN');
  });

  it('returns 422 when order is not in PENDING_PAYMENT status', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    // Force order to CANCELLED status (simulating non-PENDING_PAYMENT state).
    // cancelled_at is required by the orders_cancelled_consistency check constraint.
    await prisma.$executeRaw`UPDATE orders SET status = 'CANCELLED', cancelled_at = now() WHERE id = ${order.body.orderId}::uuid`;

    const response = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
    ).expect(422);
    expect(response.body.code).toBe('ORDER_NOT_PENDING_PAYMENT');
  });

  it('returns original attempt on idempotent retry with same key', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const idempotencyKey = randomUUID();
    const first = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
      idempotencyKey,
    ).expect(201);

    const replay = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
      idempotencyKey,
    ).expect(201);

    expect(replay.body.paymentAttemptId).toBe(first.body.paymentAttemptId);
  });

  it('returns 409 when there is already an active payment attempt', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    // First payment attempt
    await createPayment(order.body.orderId, reservation.body.token, 'FAKE_PIX').expect(201);

    // Second attempt with different idempotency key
    const response = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
    ).expect(409);
    expect(response.body.code).toBe('PAYMENT_ALREADY_ACTIVE');
  });

  it('allows new attempt after a DECLINED one', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const first = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
    ).expect(201);

    // Force the attempt to DECLINED
    await prisma.$executeRaw`
      UPDATE payment_attempts SET status = 'DECLINED' WHERE id = ${first.body.paymentAttemptId}::uuid
    `;

    // New attempt should succeed
    const second = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
    ).expect(201);
    expect(second.body.paymentAttemptId).not.toBe(first.body.paymentAttemptId);
    expect(second.body.status).toBe('PENDING');
  });

  it('retrieves latest payment attempt via GET /latest', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );
    await createPayment(order.body.orderId, reservation.body.token, 'FAKE_PIX').expect(201);

    const response = await getLatestPayment(order.body.orderId, reservation.body.token).expect(200);
    expect(response.body).toMatchObject({
      orderId: order.body.orderId,
      status: 'PENDING',
      paymentMethod: 'FAKE_PIX',
    });
  });

  it('returns 404 from GET /latest when no attempt exists', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const response = await getLatestPayment(order.body.orderId, reservation.body.token).expect(404);
    expect(response.body.code).toBe('PAYMENT_ATTEMPT_NOT_FOUND');
  });

  it('writes a payment.created.v1 outbox event', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const response = await createPayment(
      order.body.orderId,
      reservation.body.token,
      'FAKE_PIX',
    ).expect(201);

    await expect(
      prisma.outboxEvent.count({
        where: {
          type: 'payment.created.v1',
          aggregateId: response.body.paymentAttemptId,
        },
      }),
    ).resolves.toBe(1);
  });
});
