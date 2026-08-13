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
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
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

async function createEventFixture(
  input: {
    ticketTypes?: Array<{ name: string; priceAmount: number; capacity: number }>;
  } = {},
): Promise<EventFixture> {
  const unique = `${Date.now()}-${++sequence}`;
  const owner = await prisma.user.create({
    data: { email: `order-${unique}@test.com`, displayName: 'Order Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Order Organization',
      slug: `order-org-${unique}`,
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
      title: 'Order Event',
      status: 'PUBLISHED',
      slug: `order-event-${unique}`,
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

describe('Public orders API', () => {
  it('creates a pending order from an active reservation, preserving its item and inventory snapshots', async () => {
    const fixture = await createEventFixture({
      ticketTypes: [
        { name: 'General', priceAmount: 5000, capacity: 10 },
        { name: 'VIP', priceAmount: 12000, capacity: 5 },
      ],
    });
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 2 },
      { ticketTypeId: fixture.ticketTypes[1]!.id, quantity: 1 },
    ]).expect(201);
    const reservedBefore = await Promise.all(
      fixture.ticketTypes.map(({ id }) =>
        prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: id } }),
      ),
    );

    const response = await createOrder(
      reservation.body.reservationId,
      reservation.body.token,
    ).expect(201);

    expect(response.body).toMatchObject({
      reservationId: reservation.body.reservationId,
      status: 'PENDING_PAYMENT',
      currency: 'BRL',
      subtotalAmount: 22000,
      totalAmount: 22000,
    });
    expect(response.body.orderId).toEqual(expect.any(String));
    expect(new Date(response.body.expiresAt).toISOString()).toBe(
      new Date(reservation.body.expiresAt).toISOString(),
    );
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticketTypeId: fixture.ticketTypes[0]!.id,
          name: 'General',
          quantity: 2,
          unitPriceAmount: 5000,
          subtotalAmount: 10000,
        }),
        expect.objectContaining({
          ticketTypeId: fixture.ticketTypes[1]!.id,
          name: 'VIP',
          quantity: 1,
          unitPriceAmount: 12000,
          subtotalAmount: 12000,
        }),
      ]),
    );
    await expect(
      prisma.$queryRaw<
        Array<{ status: string }>
      >`SELECT status FROM reservations WHERE id = ${reservation.body.reservationId}::uuid`,
    ).resolves.toEqual([{ status: 'CONSUMED' }]);
    await expect(
      Promise.all(
        fixture.ticketTypes.map(({ id }) =>
          prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: id } }),
        ),
      ),
    ).resolves.toEqual(reservedBefore);
    await expect(
      prisma.outboxEvent.count({
        where: { type: 'order.created.v1', aggregateId: response.body.orderId },
      }),
    ).resolves.toBe(1);
  });

  it('reads an order only with the continuation token of its reservation', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const order = await createOrder(reservation.body.reservationId, reservation.body.token).expect(
      201,
    );

    const invalid = await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${order.body.orderId}`)
      .set('X-Reservation-Token', 'f'.repeat(64))
      .expect(401);
    expect(invalid.body.code).toBe('INVALID_RESERVATION_TOKEN');
    const read = await supertest(app.getHttpServer())
      .get(`/api/v1/public/orders/${order.body.orderId}`)
      .set('X-Reservation-Token', reservation.body.token)
      .expect(200);
    expect(read.body).toMatchObject({
      orderId: order.body.orderId,
      reservationId: reservation.body.reservationId,
      status: 'PENDING_PAYMENT',
    });
  });

  it('replays an equal idempotent create and rejects a changed payload', async () => {
    const fixture = await createEventFixture();
    const firstReservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const secondReservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const key = randomUUID();
    const first = await createOrder(
      firstReservation.body.reservationId,
      firstReservation.body.token,
      key,
    ).expect(201);
    const replay = await createOrder(
      firstReservation.body.reservationId,
      firstReservation.body.token,
      key,
    ).expect(201);
    expect(replay.body.orderId).toBe(first.body.orderId);
    const conflict = await createOrder(
      secondReservation.body.reservationId,
      secondReservation.body.token,
      key,
    ).expect(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it.each([
    ['expired', 410, 'RESERVATION_EXPIRED'],
    ['cancelled', 422, 'RESERVATION_CANCELLED'],
    ['consumed', 422, 'RESERVATION_ALREADY_CONSUMED'],
  ] as const)('rejects a %s reservation', async (state, status, code) => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    if (state === 'expired') {
      await prisma.$executeRaw`
        UPDATE reservations SET expires_at = NOW() - INTERVAL '1 second'
        WHERE id = ${reservation.body.reservationId}::uuid
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE reservations SET status = ${state.toUpperCase()}
        WHERE id = ${reservation.body.reservationId}::uuid
      `;
    }
    const response = await createOrder(
      reservation.body.reservationId,
      reservation.body.token,
    ).expect(status);
    expect(response.body.code).toBe(code);
  });

  it('rejects an invalid token and a second non-idempotent order for the same reservation', async () => {
    const fixture = await createEventFixture();
    const reservation = await createReservation(fixture, [
      { ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 },
    ]).expect(201);
    const invalid = await createOrder(reservation.body.reservationId, '0'.repeat(64)).expect(401);
    expect(invalid.body.code).toBe('INVALID_RESERVATION_TOKEN');
    await createOrder(reservation.body.reservationId, reservation.body.token).expect(201);
    const duplicate = await createOrder(
      reservation.body.reservationId,
      reservation.body.token,
    ).expect(409);
    expect(duplicate.body.code).toBe('ORDER_ALREADY_EXISTS');
  });

  it('allows only one concurrent order creation for a reservation and keeps inventory reserved', async () => {
    const fixture = await createEventFixture();
    const ticketType = fixture.ticketTypes[0]!;
    const reservation = await createReservation(fixture, [
      { ticketTypeId: ticketType.id, quantity: 1 },
    ]).expect(201);
    const results = await Promise.all([
      createOrder(reservation.body.reservationId, reservation.body.token),
      createOrder(reservation.body.reservationId, reservation.body.token),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409)?.body.code).toBe('ORDER_ALREADY_EXISTS');
    await expect(
      prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*) AS count FROM orders WHERE reservation_id = ${reservation.body.reservationId}::uuid`,
    ).resolves.toEqual([{ count: BigInt(1) }]);
    await expect(
      prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: ticketType.id } }),
    ).resolves.toMatchObject({ reserved: 1, committed: 0 });
  });
});
