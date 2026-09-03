import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'crypto';
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
  eventId: string;
  slug: string;
  ticketTypes: Array<{ id: string; name: string; priceAmount: number; capacity: number }>;
};

const createIdempotencyKey = (): string => randomUUID();

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
  await prisma.$executeRawUnsafe('DELETE FROM reservation_items');
  await prisma.$executeRawUnsafe('DELETE FROM reservations');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_inventory');
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function createEventFixture(input: {
  status?: 'PUBLISHED' | 'DRAFT';
  currency?: string;
  ticketTypes?: Array<{ name: string; priceAmount: number; capacity: number; status?: string }>;
} = {}): Promise<EventFixture> {
  const unique = `${Date.now()}-${++sequence}`;
  const owner = await prisma.user.create({
    data: { email: `reservation-${unique}@test.com`, displayName: 'Reservation Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Reservation Organization',
      slug: `reservation-org-${unique}`,
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
      title: 'Reservation Event',
      status: input.status ?? 'PUBLISHED',
      slug: `reservation-event-${unique}`,
      currency: input.currency ?? 'BRL',
      publishedAt: input.status === 'DRAFT' ? null : new Date(),
    },
  });
  const ticketTypes = await Promise.all(
    (input.ticketTypes ?? [{ name: 'General', priceAmount: 5000, capacity: 10 }]).map(
      async (ticketType) => {
        const created = await prisma.ticketType.create({
          data: {
            eventId: event.id,
            organizationId: organization.id,
            name: ticketType.name,
            priceAmount: ticketType.priceAmount,
            capacity: ticketType.capacity,
            status: ticketType.status ?? 'ACTIVE',
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

  return { organizationId: organization.id, eventId: event.id, slug: event.slug!, ticketTypes };
}

function postReservation(
  payload: { eventSlug: string; items: Array<Record<string, unknown>> },
  idempotencyKey = createIdempotencyKey(),
) {
  return supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', idempotencyKey)
    .send(payload);
}

describe('Public reservations API', () => {
  it('creates a reservation with backend price, event currency, server TTL and one-time token', async () => {
    const fixture = await createEventFixture();
    const ticketType = fixture.ticketTypes[0]!;
    const before = Date.now();

    const response = await postReservation({
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: ticketType.id, quantity: 2, priceAmount: 1 }],
    }).expect(201);

    expect(response.body).toMatchObject({
      status: 'ACTIVE',
      currency: 'BRL',
      subtotalAmount: 10000,
      items: [
        {
          ticketTypeId: ticketType.id,
          name: 'General',
          quantity: 2,
          unitPriceAmount: 5000,
          subtotalAmount: 10000,
        },
      ],
    });
    expect(response.body.reservationId).toEqual(expect.any(String));
    expect(response.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThanOrEqual(before + 14 * 60_000);
    expect(new Date(response.body.expiresAt).getTime()).toBeLessThanOrEqual(before + 16 * 60_000);

    const persisted = await prisma.$queryRaw<Array<{ continuation_token_hash: string }>>`
      SELECT continuation_token_hash FROM reservations WHERE id = ${response.body.reservationId}::uuid
    `;
    expect(persisted[0]?.continuation_token_hash).toBe(
      createHash('sha256').update(response.body.token).digest('hex'),
    );
    expect(persisted[0]?.continuation_token_hash).not.toBe(response.body.token);

    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { ticketTypeId: ticketType.id },
    });
    expect(inventory.reserved).toBe(2);
    await expect(
      prisma.outboxEvent.count({
        where: { type: 'reservation.created.v1', aggregateId: response.body.reservationId },
      }),
    ).resolves.toBe(1);
  });

  it('creates a reservation with multiple ticket types and sums item subtotals', async () => {
    const fixture = await createEventFixture({
      ticketTypes: [
        { name: 'General', priceAmount: 5000, capacity: 10 },
        { name: 'VIP', priceAmount: 12000, capacity: 5 },
      ],
    });
    const [general, vip] = fixture.ticketTypes;

    const response = await postReservation({
      eventSlug: fixture.slug,
      items: [
        { ticketTypeId: general!.id, quantity: 2 },
        { ticketTypeId: vip!.id, quantity: 3 },
      ],
    }).expect(201);

    expect(response.body.subtotalAmount).toBe(46000);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ticketTypeId: general!.id, subtotalAmount: 10000 }),
        expect.objectContaining({ ticketTypeId: vip!.id, subtotalAmount: 36000 }),
      ]),
    );
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
  ])('rejects a %s item quantity with INVALID_ITEMS', async (_label, quantity) => {
    const fixture = await createEventFixture();
    const response = await postReservation({
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: fixture.ticketTypes[0]!.id, quantity }],
    }).expect(400);
    expect(response.body.code).toBe('INVALID_ITEMS');
  });

  it('rejects inactive ticket types, unpublished events and insufficient inventory', async () => {
    const inactive = await createEventFixture({
      ticketTypes: [{ name: 'Inactive', priceAmount: 5000, capacity: 3, status: 'INACTIVE' }],
    });
    const inactiveResponse = await postReservation({
      eventSlug: inactive.slug,
      items: [{ ticketTypeId: inactive.ticketTypes[0]!.id, quantity: 1 }],
    }).expect(422);
    expect(inactiveResponse.body.code).toBe('TICKET_TYPE_INACTIVE');

    const draft = await createEventFixture({ status: 'DRAFT' });
    const draftResponse = await postReservation({
      eventSlug: draft.slug,
      items: [{ ticketTypeId: draft.ticketTypes[0]!.id, quantity: 1 }],
    }).expect(422);
    expect(draftResponse.body.code).toBe('EVENT_NOT_PUBLISHED');

    const soldOut = await createEventFixture({
      ticketTypes: [{ name: 'Limited', priceAmount: 5000, capacity: 1 }],
    });
    const soldOutResponse = await postReservation({
      eventSlug: soldOut.slug,
      items: [{ ticketTypeId: soldOut.ticketTypes[0]!.id, quantity: 2 }],
    }).expect(422);
    expect(soldOutResponse.body.code).toBe('INSUFFICIENT_INVENTORY');
  });

  it('replays the original reservation for an equal idempotent request and rejects a changed payload', async () => {
    const fixture = await createEventFixture();
    const key = createIdempotencyKey();
    const payload = {
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 }],
    };
    const first = await postReservation(payload, key).expect(201);
    const replay = await postReservation(payload, key).expect(201);

    expect(replay.body.reservationId).toBe(first.body.reservationId);
    expect(replay.body.token).toBeUndefined();
    await expect(prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM reservations`).resolves.toEqual([
      { count: BigInt(1) },
    ]);

    const conflict = await postReservation(
      { ...payload, items: [{ ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 2 }] },
      key,
    ).expect(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('requires the continuation token for reads and hides it from read responses', async () => {
    const fixture = await createEventFixture();
    const created = await postReservation({
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 }],
    }).expect(201);

    const invalid = await supertest(app.getHttpServer())
      .get(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', 'f'.repeat(64))
      .expect(401);
    expect(invalid.body.code).toBe('INVALID_RESERVATION_TOKEN');

    const read = await supertest(app.getHttpServer())
      .get(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', created.body.token)
      .expect(200);
    expect(read.body.reservationId).toBe(created.body.reservationId);
    expect(read.body.token).toBeUndefined();

    const missing = await supertest(app.getHttpServer())
      .get('/api/v1/public/reservations/f47ac10b-58cc-4372-a567-0e02b2c3d479')
      .set('X-Reservation-Token', created.body.token)
      .expect(404);
    expect(missing.body.status).toBe(404);
  });

  it('cancels once, releases inventory and makes repeated cancellation idempotent', async () => {
    const fixture = await createEventFixture();
    const ticketType = fixture.ticketTypes[0]!;
    const created = await postReservation({
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
    }).expect(201);

    const invalid = await supertest(app.getHttpServer())
      .delete(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', 'a'.repeat(64))
      .expect(401);
    expect(invalid.body.code).toBe('INVALID_RESERVATION_TOKEN');

    await supertest(app.getHttpServer())
      .delete(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', created.body.token)
      .expect(204);
    await supertest(app.getHttpServer())
      .delete(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', created.body.token)
      .expect(204);

    const state = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM reservations WHERE id = ${created.body.reservationId}::uuid
    `;
    expect(state[0]?.status).toBe('CANCELLED');
    await expect(
      prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: ticketType.id } }),
    ).resolves.toMatchObject({ reserved: 0 });
    await expect(
      prisma.outboxEvent.count({
        where: { type: 'reservation.cancelled.v1', aggregateId: created.body.reservationId },
      }),
    ).resolves.toBe(1);
  });

  it('treats cancellation of an expired reservation as successful and rejects reads as expired', async () => {
    const fixture = await createEventFixture();
    const created = await postReservation({
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 }],
    }).expect(201);
    await prisma.$executeRaw`
      UPDATE reservations SET expires_at = NOW() - INTERVAL '1 second'
      WHERE id = ${created.body.reservationId}::uuid
    `;

    const read = await supertest(app.getHttpServer())
      .get(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', created.body.token)
      .expect(410);
    expect(read.body.code).toBe('RESERVATION_EXPIRED');

    await supertest(app.getHttpServer())
      .delete(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', created.body.token)
      .expect(204);
  });

  it('keeps a price snapshot after ticket type prices change', async () => {
    const fixture = await createEventFixture();
    const ticketType = fixture.ticketTypes[0]!;
    const created = await postReservation({
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(201);
    await prisma.ticketType.update({ where: { id: ticketType.id }, data: { priceAmount: 9000 } });

    const read = await supertest(app.getHttpServer())
      .get(`/api/v1/public/reservations/${created.body.reservationId}`)
      .set('X-Reservation-Token', created.body.token)
      .expect(200);
    expect(read.body.items[0]).toMatchObject({ unitPriceAmount: 5000, subtotalAmount: 5000 });
  });

  it('allows exactly one simultaneous reservation to obtain the last unit', async () => {
    const fixture = await createEventFixture({
      ticketTypes: [{ name: 'Last Unit', priceAmount: 5000, capacity: 1 }],
    });
    const payload = {
      eventSlug: fixture.slug,
      items: [{ ticketTypeId: fixture.ticketTypes[0]!.id, quantity: 1 }],
    };

    const results = await Promise.all([postReservation(payload), postReservation(payload)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 422]);
    expect(results.find((result) => result.status === 422)?.body.code).toBe('INSUFFICIENT_INVENTORY');
    await expect(
      prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypes[0]!.id } }),
    ).resolves.toMatchObject({ reserved: 1 });
  });

  it('rolls back already acquired inventory if a later reservation item cannot be held', async () => {
    const fixture = await createEventFixture({
      ticketTypes: [
        { name: 'Available', priceAmount: 5000, capacity: 2 },
        { name: 'Unavailable', priceAmount: 5000, capacity: 1 },
      ],
    });

    await prisma.ticketInventory.update({
      where: { ticketTypeId: fixture.ticketTypes[1]!.id },
      data: { committed: 1 },
    });

    const response = await postReservation({
      eventSlug: fixture.slug,
      items: fixture.ticketTypes.map((ticketType) => ({ ticketTypeId: ticketType.id, quantity: 1 })),
    }).expect(422);
    expect(response.body.code).toBe('INSUFFICIENT_INVENTORY');
    await expect(
      prisma.ticketInventory.findUniqueOrThrow({ where: { ticketTypeId: fixture.ticketTypes[0]!.id } }),
    ).resolves.toMatchObject({ reserved: 0 });
    await expect(prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM reservations`).resolves.toEqual([
      { count: BigInt(0) },
    ]);
  });
});
