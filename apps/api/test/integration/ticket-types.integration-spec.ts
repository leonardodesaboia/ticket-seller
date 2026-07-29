import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawnSync } from 'child_process';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/platform/http/filters/http-exception.filter';
import { PrismaService } from '../../src/platform/database/prisma.service';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;

const INVALID_UUID = 'not-a-valid-uuid';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  process.env['DATABASE_URL'] = url;

  const result = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(result.status)}`);
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

describe('Ticket Types API', () => {
  let testUserId: string;
  let organizationId: string;
  let eventId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `owner-${Date.now()}@test.com`, displayName: 'Test Owner' },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: { name: 'Test Org', slug: `test-org-${Date.now()}`, status: 'ACTIVE', ownerId: testUserId },
    });
    organizationId = org.id;

    await prisma.organizationMember.create({
      data: { organizationId, userId: testUserId, role: 'OWNER', status: 'ACTIVE' },
    });

    const event = await prisma.event.create({
      data: { organizationId, title: 'Test Event', status: 'DRAFT', currency: 'BRL' },
    });
    eventId = event.id;
  });

  afterEach(async () => {
    await prisma.outboxEvent.deleteMany();
    await prisma.ticketType.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.event.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  // ── POST ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/organizations/:orgId/events/:eventId/ticket-types', () => {
    it('returns 201 and creates ticket type', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-1')
        .send({ name: 'General', priceAmount: 5000, capacity: 100 })
        .expect(201);

      expect(res.body).toMatchObject({
        eventId,
        organizationId,
        name: 'General',
        priceAmount: 5000,
        capacity: 100,
        status: 'ACTIVE',
        version: 1,
      });
      expect(res.body.id).toBeDefined();
    });

    it('returns 201 with free ticket (priceAmount = 0)', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-free')
        .send({ name: 'Free Pass', priceAmount: 0, capacity: 50 })
        .expect(201);

      expect(res.body.priceAmount).toBe(0);
    });

    it('returns same response when idempotency key is reused', async () => {
      const res1 = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-idempotent')
        .send({ name: 'VIP', priceAmount: 20000, capacity: 10 })
        .expect(201);

      const res2 = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-idempotent')
        .send({ name: 'VIP', priceAmount: 20000, capacity: 10 })
        .expect(201);

      expect(res1.body.id).toBe(res2.body.id);

      const count = await prisma.ticketType.count({ where: { eventId } });
      expect(count).toBe(1);
    });

    it('writes ticket-type.created.v1 to outbox', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-outbox')
        .send({ name: 'Outbox Test', priceAmount: 1000, capacity: 20 })
        .expect(201);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: 'ticket-type.created.v1', aggregateId: res.body.id as string },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.organizationId).toBe(organizationId);
    });

    it('returns 422 when Idempotency-Key header is missing', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .send({ name: 'Test', priceAmount: 1000, capacity: 10 })
        .expect(422);
    });

    it('returns 422 when event has no currency set', async () => {
      const eventNoCurrency = await prisma.event.create({
        data: { organizationId, title: 'No Currency Event', status: 'DRAFT' },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventNoCurrency.id}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-nocurrency')
        .send({ name: 'General', priceAmount: 1000, capacity: 50 })
        .expect(422);
    });

    it('returns 422 when event is not in DRAFT', async () => {
      const publishedEvent = await prisma.event.create({
        data: { organizationId, title: 'Published', status: 'PUBLISHED', currency: 'BRL' },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${publishedEvent.id}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-published')
        .send({ name: 'General', priceAmount: 1000, capacity: 50 })
        .expect(422);
    });

    it('returns 400 when priceAmount is negative', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-neg')
        .send({ name: 'Test', priceAmount: -1, capacity: 10 })
        .expect(400);
    });

    it('returns 400 when capacity is zero', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-cap0')
        .send({ name: 'Test', priceAmount: 1000, capacity: 0 })
        .expect(400);
    });

    it('returns 400 for invalid eventId UUID', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${INVALID_UUID}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .set('Idempotency-Key', 'key-uuid')
        .send({ name: 'Test', priceAmount: 1000, capacity: 10 })
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('Idempotency-Key', 'key-auth')
        .send({ name: 'Test', priceAmount: 1000, capacity: 10 })
        .expect(401);
    });

    it('returns 403 when actor has VIEWER role', async () => {
      const viewer = await prisma.user.create({
        data: { email: `v-${Date.now()}@test.com`, displayName: 'Viewer' },
      });
      await prisma.organizationMember.create({
        data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
      });
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', viewer.id)
        .set('Idempotency-Key', 'key-viewer')
        .send({ name: 'Test', priceAmount: 1000, capacity: 10 })
        .expect(403);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `s-${Date.now()}@test.com`, displayName: 'Stranger' },
      });
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', stranger.id)
        .set('Idempotency-Key', 'key-stranger')
        .send({ name: 'Test', priceAmount: 1000, capacity: 10 })
        .expect(404);
      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });

  // ── GET LIST ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/organizations/:orgId/events/:eventId/ticket-types', () => {
    beforeEach(async () => {
      await prisma.ticketType.createMany({
        data: [
          { eventId, organizationId, name: 'General', priceAmount: 5000, capacity: 100, status: 'ACTIVE' },
          { eventId, organizationId, name: 'VIP', priceAmount: 20000, capacity: 20, status: 'ACTIVE' },
        ],
      });
    });

    it('returns 200 with list of ticket types', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({ eventId, organizationId });
    });

    it('returns 400 for invalid eventId UUID', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${INVALID_UUID}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types`)
        .expect(401);
    });

    it('returns 404 when event does not exist', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${NONEXISTENT_UUID}/ticket-types`)
        .set('X-Dev-User-Id', testUserId)
        .expect(404);
    });
  });

  // ── PATCH ─────────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/organizations/:orgId/events/:eventId/ticket-types/:id', () => {
    let ticketTypeId: string;

    beforeEach(async () => {
      const tt = await prisma.ticketType.create({
        data: { eventId, organizationId, name: 'General', priceAmount: 5000, capacity: 100, status: 'ACTIVE' },
      });
      ticketTypeId = tt.id;
    });

    it('returns 200 and updates name', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, name: 'Updated General' })
        .expect(200);

      expect(res.body.name).toBe('Updated General');
      expect(res.body.version).toBe(2);
    });

    it('returns 200 and deactivates ticket type', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, status: 'INACTIVE' })
        .expect(200);

      expect(res.body.status).toBe('INACTIVE');
    });

    it('writes ticket-type.updated.v1 to outbox on regular update', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, capacity: 200 })
        .expect(200);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: 'ticket-type.updated.v1', aggregateId: ticketTypeId },
      });
      expect(outbox).not.toBeNull();
    });

    it('writes ticket-type.deactivated.v1 to outbox on deactivation', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, status: 'INACTIVE' })
        .expect(200);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: 'ticket-type.deactivated.v1', aggregateId: ticketTypeId },
      });
      expect(outbox).not.toBeNull();
    });

    it('returns 409 when version conflicts', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, name: 'First' })
        .expect(200);

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, name: 'Conflict' })
        .expect(409);
    });

    it('returns 400 for invalid ticketTypeId UUID', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${INVALID_UUID}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1 })
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .send({ expectedVersion: 1 })
        .expect(401);
    });

    it('returns 403 when actor has VIEWER role', async () => {
      const viewer = await prisma.user.create({
        data: { email: `vtt-${Date.now()}@test.com`, displayName: 'V' },
      });
      await prisma.organizationMember.create({
        data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
      });
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${ticketTypeId}`)
        .set('X-Dev-User-Id', viewer.id)
        .send({ expectedVersion: 1, name: 'New' })
        .expect(403);
    });

    it('returns 404 when ticket type does not exist', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/ticket-types/${NONEXISTENT_UUID}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1 })
        .expect(404);
    });
  });

  // ── CURRENCY LOCK ─────────────────────────────────────────────────────────

  describe('Currency lock', () => {
    it('returns 422 when changing currency after ticket types exist', async () => {
      await prisma.ticketType.create({
        data: { eventId, organizationId, name: 'General', priceAmount: 5000, capacity: 100, status: 'ACTIVE' },
      });

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, currency: 'USD' })
        .expect(422);
    });

    it('allows updating other configuration fields when ticket types exist', async () => {
      await prisma.ticketType.create({
        data: { eventId, organizationId, name: 'General', priceAmount: 5000, capacity: 100, status: 'ACTIVE' },
      });

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'IN_PERSON' })
        .expect(200);
    });
  });
});
