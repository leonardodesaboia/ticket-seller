import { INestApplication, ValidationPipe } from '@nestjs/common';
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
  app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

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
      data: {
        organizationId,
        userId: testUserId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async () => {
    await prisma.outboxEvent.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/organizations/:organizationId/events', () => {
    it('returns 201 and creates event as DRAFT', async () => {
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
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
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

    it('returns 401 when X-Dev-User-Id header is missing', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .send({ title: 'Event' })
        .expect(401);
    });

    it('returns 404 when actor is not a member of the organization', async () => {
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

    it('returns 400 when title is empty', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/events`)
        .set('X-Dev-User-Id', testUserId)
        .send({ title: '' })
        .expect(400);
    });
  });

  describe('GET /api/v1/organizations/:organizationId/events/:eventId', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await prisma.event.create({
        data: {
          organizationId,
          title: 'Existing Event',
          status: 'DRAFT',
        },
      });
      eventId = event.id;
    });

    it('returns 200 with event data', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(res.body).toMatchObject({
        id: eventId,
        organizationId,
        title: 'Existing Event',
        status: 'DRAFT',
      });
    });

    it('returns 401 when X-Dev-User-Id header is missing', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .expect(401);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `stranger2-${Date.now()}@test.com`, displayName: 'Stranger' },
      });

      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/${eventId}`)
        .set('X-Dev-User-Id', stranger.id)
        .expect(404);

      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('returns 404 when event does not exist', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/events/00000000-0000-0000-0000-000000000000`)
        .set('X-Dev-User-Id', testUserId)
        .expect(404);
    });

    it('returns 404 when event belongs to different organization', async () => {
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
});
