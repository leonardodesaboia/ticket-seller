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
// Valid v4 UUID that won't match any entity (version=4 at position 14, variant=8 at position 19)
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

describe('Events API', () => {
  let testUserId: string;
  let organizationId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `owner-${Date.now()}@test.com`, displayName: 'Test Owner' },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        slug: `test-org-${Date.now()}`,
        status: 'ACTIVE',
        ownerId: testUserId,
      },
    });
    organizationId = org.id;

    await prisma.organizationMember.create({
      data: { organizationId, userId: testUserId, role: 'OWNER', status: 'ACTIVE' },
    });
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

  describe('POST /api/v1/organizations/:organizationId/events', () => {
    it('returns 201 and creates event as DRAFT with version 1', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Rock Festival 2026' })
        .expect(201);

      expect(res.body).toMatchObject({
        organizationId,
        title: 'Rock Festival 2026',
        status: 'DRAFT',
        description: null,
        version: 1,
      });
      expect(res.body.id).toBeDefined();
    });

    it('writes event.created.v1 to outbox atomically', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Outbox Test Event' })
        .expect(201);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: 'event.created.v1', aggregateId: res.body.id as string },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.aggregateType).toBe('event');
      expect(outbox?.organizationId).toBe(organizationId);
    });

    it('returns 201 with optional description', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Festival', description: 'An annual festival' })
        .expect(201);

      expect(res.body.description).toBe('An annual festival');
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${INVALID_UUID}/events`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Event' })
        .expect(400);
    });

    it('returns 401 when X-Dev-User-Id header is missing', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .send({ title: 'Event' })
        .expect(401);
    });

    it('returns 403 when actor has VIEWER role', async () => {
      const viewer = await prisma.user.create({
        data: { email: `viewer-${Date.now()}@test.com`, displayName: 'Viewer' },
      });
      await prisma.organizationMember.create({
        data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', viewer.id)
        .send({ title: 'Event' })
        .expect(403);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `stranger-${Date.now()}@test.com`, displayName: 'Stranger' },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', stranger.id)
        .send({ title: 'Event' })
        .expect(404);

      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('returns 400 when title is empty', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: '' })
        .expect(400);
    });
  });

  // ── GET LIST ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/organizations/:organizationId/events', () => {
    beforeEach(async () => {
      await prisma.event.createMany({
        data: [
          { organizationId, title: 'Event A', status: 'DRAFT' },
          { organizationId, title: 'Event B', status: 'DRAFT' },
          { organizationId, title: 'Event C', status: 'DRAFT' },
        ],
      });
    });

    it('returns 200 with list of events and null nextCursor', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.data[0]).toMatchObject({ organizationId, status: 'DRAFT', version: 1 });
    });

    it('paginates with limit and nextCursor', async () => {
      const page1 = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events?limit=2`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.nextCursor).not.toBeNull();

      const page2 = await supertest(app.getHttpServer())
        .get(
          `/api/v1/organizations/${organizationId}/events?limit=2&cursor=${page1.body.nextCursor as string}`,
        )
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.nextCursor).toBeNull();

      const allTitles = [
        ...(page1.body.data as Array<{ title: string }>).map((e) => e.title),
        ...(page2.body.data as Array<{ title: string }>).map((e) => e.title),
      ];
      expect(allTitles).toHaveLength(3);
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${INVALID_UUID}/events`)
        .set('X-Dev-User-Id', testUserId)
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events`)
        .expect(401);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `s-${Date.now()}@test.com`, displayName: 'S' },
      });
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', stranger.id)
        .expect(404);
      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });

  // ── GET BY ID ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/organizations/:organizationId/events/:eventId', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await prisma.event.create({
        data: { organizationId, title: 'Existing Event', status: 'DRAFT' },
      });
      eventId = event.id;
    });

    it('returns 200 with event data including version', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(res.body).toMatchObject({
        id: eventId,
        organizationId,
        title: 'Existing Event',
        status: 'DRAFT',
        version: 1,
      });
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${INVALID_UUID}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .expect(400);
    });

    it('returns 400 for invalid eventId UUID', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${INVALID_UUID}`)
        .set('X-Dev-User-Id', testUserId)
        .expect(400);
    });

    it('returns 404 for valid UUID that does not exist', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${NONEXISTENT_UUID}`)
        .set('X-Dev-User-Id', testUserId)
        .expect(404);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .expect(401);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `s2-${Date.now()}@test.com`, displayName: 'S' },
      });
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', stranger.id)
        .expect(404);
      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('returns 404 when event belongs to a different organization', async () => {
      const otherUser = await prisma.user.create({
        data: { email: `other-${Date.now()}@test.com`, displayName: 'Other' },
      });
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Org',
          slug: `other-${Date.now()}`,
          status: 'ACTIVE',
          ownerId: otherUser.id,
        },
      });

      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${otherOrg.id}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .expect(404);

      await prisma.organization.delete({ where: { id: otherOrg.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  // ── PATCH ─────────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/organizations/:organizationId/events/:eventId', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await prisma.event.create({
        data: { organizationId, title: 'Original Title', status: 'DRAFT' },
      });
      eventId = event.id;
    });

    it('returns 200 and updates title, increments version', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Updated Title', version: 1 })
        .expect(200);

      expect(res.body).toMatchObject({
        id: eventId,
        title: 'Updated Title',
        version: 2,
        status: 'DRAFT',
      });
    });

    it('writes event.updated.v1 to outbox', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Updated', version: 1 })
        .expect(200);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: 'event.updated.v1', aggregateId: eventId },
      });
      expect(outbox).not.toBeNull();
      expect((outbox?.payload as { version: number }).version).toBe(2);
    });

    it('returns 409 when version conflicts', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'First update', version: 1 })
        .expect(200);

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Concurrent update', version: 1 })
        .expect(409);
    });

    it('returns 422 when event is not in DRAFT', async () => {
      await prisma.event.update({ where: { id: eventId }, data: { status: 'PUBLISHED' } });

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'New Title', version: 1 })
        .expect(422);
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${INVALID_UUID}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ version: 1 })
        .expect(400);
    });

    it('returns 400 for invalid eventId UUID', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${INVALID_UUID}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ version: 1 })
        .expect(400);
    });

    it('returns 400 when version is missing', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: 'Title' })
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .send({ version: 1 })
        .expect(401);
    });

    it('returns 403 when actor has VIEWER role', async () => {
      const viewer = await prisma.user.create({
        data: { email: `v-${Date.now()}@test.com`, displayName: 'V' },
      });
      await prisma.organizationMember.create({
        data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
      });
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', viewer.id)
        .send({ title: 'New', version: 1 })
        .expect(403);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `s3-${Date.now()}@test.com`, displayName: 'S' },
      });
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', stranger.id)
        .send({ title: 'New', version: 1 })
        .expect(404);
      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });

  // ── PATCH CONFIGURATION ───────────────────────────────────────────────────

  describe('PATCH /api/v1/organizations/:organizationId/events/:eventId/configuration', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await prisma.event.create({
        data: { organizationId, title: 'Config Event', status: 'DRAFT' },
      });
      eventId = event.id;
    });

    it('returns 200 and updates format and timezone', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'IN_PERSON', timezone: 'America/Sao_Paulo' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: eventId,
        format: 'IN_PERSON',
        timezone: 'America/Sao_Paulo',
        version: 2,
      });
    });

    it('returns 200 and updates startsAt and endsAt', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({
          expectedVersion: 1,
          startsAt: '2026-08-01T18:00:00.000Z',
          endsAt: '2026-08-01T22:00:00.000Z',
        })
        .expect(200);

      expect(res.body.startsAt).toBe('2026-08-01T18:00:00.000Z');
      expect(res.body.endsAt).toBe('2026-08-01T22:00:00.000Z');
      expect(res.body.version).toBe(2);
    });

    it('returns 200 and updates currency', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, currency: 'BRL' })
        .expect(200);

      expect(res.body.currency).toBe('BRL');
    });

    it('serializes currency change with concurrent ticket type creation', async () => {
      let releaseTransaction = (): void => undefined;
      const release = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });
      let signalLockAcquired = (): void => undefined;
      const lockAcquired = new Promise<void>((resolve) => {
        signalLockAcquired = resolve;
      });

      const ticketCreation = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM events
          WHERE id = ${eventId}::uuid
            AND organization_id = ${organizationId}::uuid
          FOR UPDATE
        `;
        await tx.ticketType.create({
          data: {
            eventId,
            organizationId,
            name: 'Concurrent',
            priceAmount: 1000,
            capacity: 10,
          },
        });
        signalLockAcquired();
        await release;
      });

      await lockAcquired;
      const currencyChange = supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, currency: 'USD' });

      const responsePromise = currencyChange.then((response) => response);
      await new Promise((resolve) => setTimeout(resolve, 100));
      releaseTransaction();
      await ticketCreation;
      const response = await responsePromise;

      expect(response.status).toBe(422);
      const stored = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(stored.currency).toBeNull();
    });

    it('returns 200 and updates venueId when venue belongs to same org', async () => {
      const venue = await prisma.venue.create({
        data: {
          organizationId,
          name: 'Main Arena',
          address: 'Rua das Flores, 100',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
        },
      });

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, venueId: venue.id })
        .expect(200);

      expect(res.body.venueId).toBe(venue.id);
      expect(res.body.version).toBe(2);
    });

    it('writes event.configuration-updated.v1 to outbox atomically', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'ONLINE' })
        .expect(200);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: 'event.configuration-updated.v1', aggregateId: eventId },
      });
      expect(outbox).not.toBeNull();
      expect((outbox?.payload as { version: number }).version).toBe(2);
    });

    it('returns 409 when version conflicts', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'ONLINE' })
        .expect(200);

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'IN_PERSON' })
        .expect(409);
    });

    it('returns 422 when event is not in DRAFT', async () => {
      await prisma.event.update({ where: { id: eventId }, data: { status: 'PUBLISHED' } });

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'ONLINE' })
        .expect(422);
    });

    it('returns 422 for invalid IANA timezone', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, timezone: 'Not/ATimezone' })
        .expect(422);
    });

    it('returns 422 when endsAt is before startsAt', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({
          expectedVersion: 1,
          startsAt: '2026-08-01T22:00:00.000Z',
          endsAt: '2026-08-01T18:00:00.000Z',
        })
        .expect(422);
    });

    it('returns 422 when venue belongs to a different organization', async () => {
      const otherUser = await prisma.user.create({
        data: { email: `other-${Date.now()}@test.com`, displayName: 'Other' },
      });
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Org', slug: `other-${Date.now()}`, status: 'ACTIVE', ownerId: otherUser.id },
      });
      const otherVenue = await prisma.venue.create({
        data: {
          organizationId: otherOrg.id,
          name: 'Other Venue',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
        },
      });

      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, venueId: otherVenue.id })
        .expect(422);

      await prisma.venue.delete({ where: { id: otherVenue.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${INVALID_UUID}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1 })
        .expect(400);
    });

    it('returns 400 for invalid eventId UUID', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${INVALID_UUID}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1 })
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .send({ expectedVersion: 1 })
        .expect(401);
    });

    it('returns 403 when actor has VIEWER role', async () => {
      const viewer = await prisma.user.create({
        data: { email: `vcfg-${Date.now()}@test.com`, displayName: 'V' },
      });
      await prisma.organizationMember.create({
        data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
      });
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', viewer.id)
        .send({ expectedVersion: 1, format: 'ONLINE' })
        .expect(403);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `scfg-${Date.now()}@test.com`, displayName: 'S' },
      });
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', stranger.id)
        .send({ expectedVersion: 1, format: 'ONLINE' })
        .expect(404);
      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('exposes only onlineConfigured after setting private onlineInfo', async () => {
      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, onlineInfo: 'https://meet.example.com/secret' })
        .expect(200);

      expect(res.body).not.toHaveProperty('onlineInfo');
      expect(res.body.onlineConfigured).toBe(true);

      const outbox = await prisma.outboxEvent.findFirstOrThrow({
        where: { type: 'event.configuration-updated.v1', aggregateId: eventId },
        orderBy: { createdAt: 'desc' },
      });
      expect(JSON.stringify(outbox.payload)).not.toContain('meet.example.com/secret');
      expect(outbox.payload).toMatchObject({ changedFields: ['onlineInfo'] });
    });

    it('preserves private onlineInfo when omitted during a format change', async () => {
      await prisma.event.update({
        where: { id: eventId },
        data: { onlineInfo: 'private-access' },
      });

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, format: 'IN_PERSON' })
        .expect(200);

      expect(res.body.onlineConfigured).toBe(true);
      const stored = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(stored.onlineInfo).toBe('private-access');
    });

    it('clears private onlineInfo only with clearOnlineInfo true', async () => {
      await prisma.event.update({
        where: { id: eventId },
        data: { onlineInfo: 'private-access' },
      });

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, clearOnlineInfo: true })
        .expect(200);

      expect(res.body.onlineConfigured).toBe(false);
      const stored = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(stored.onlineInfo).toBeNull();
    });

    it.each([
      { onlineInfo: null },
      { onlineInfo: '' },
      { onlineInfo: '   ' },
      { onlineInfo: 'x'.repeat(2001) },
      { onlineInfo: 'private-access', clearOnlineInfo: true },
    ])('returns 400 for invalid onlineInfo command %p', async (body) => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/events/${eventId}/configuration`)
        .set('X-Dev-User-Id', testUserId)
        .send({ expectedVersion: 1, ...body })
        .expect(400);
    });
  });
});
