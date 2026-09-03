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

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
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

describe('Venues API', () => {
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
    await prisma.event.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  // ── POST ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/organizations/:organizationId/venues', () => {
    it('returns 201 and creates venue', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .send({
          name: 'Main Arena',
          address: 'Rua das Flores, 100',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        organizationId,
        name: 'Main Arena',
        address: 'Rua das Flores, 100',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        postalCode: null,
      });
      expect(res.body.id).toBeDefined();
    });

    it('returns 201 with optional postalCode', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .send({
          name: 'Centro de Eventos',
          address: 'Av. Brasil, 500',
          city: 'Curitiba',
          state: 'PR',
          country: 'BR',
          postalCode: '80000-000',
        })
        .expect(201);

      expect(res.body.postalCode).toBe('80000-000');
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${INVALID_UUID}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .send({
          name: 'Arena',
          address: 'Rua A',
          city: 'SP',
          state: 'SP',
          country: 'BR',
        })
        .expect(400);
    });

    it('returns 400 when required fields are missing', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .send({ name: 'Arena' })
        .expect(400);
    });

    it('returns 400 when country is not 2 chars', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .send({
          name: 'Arena',
          address: 'Rua A',
          city: 'SP',
          state: 'SP',
          country: 'BRA',
        })
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .send({ name: 'Arena', address: 'Rua A', city: 'SP', state: 'SP', country: 'BR' })
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
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', viewer.id)
        .send({ name: 'Arena', address: 'Rua A', city: 'SP', state: 'SP', country: 'BR' })
        .expect(403);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `stranger-${Date.now()}@test.com`, displayName: 'Stranger' },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', stranger.id)
        .send({ name: 'Arena', address: 'Rua A', city: 'SP', state: 'SP', country: 'BR' })
        .expect(404);

      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });

  // ── GET LIST ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/organizations/:organizationId/venues', () => {
    beforeEach(async () => {
      await prisma.venue.createMany({
        data: [
          { organizationId, name: 'Venue A', address: 'Rua A', city: 'SP', state: 'SP', country: 'BR' },
          { organizationId, name: 'Venue B', address: 'Rua B', city: 'RJ', state: 'RJ', country: 'BR' },
        ],
      });
    });

    it('returns 200 with list of venues sorted by name', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({ organizationId, name: 'Venue A' });
      expect(res.body.data[1]).toMatchObject({ organizationId, name: 'Venue B' });
    });

    it('returns only venues belonging to the requesting organization', async () => {
      const otherUser = await prisma.user.create({
        data: { email: `other-${Date.now()}@test.com`, displayName: 'Other' },
      });
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Org', slug: `other-${Date.now()}`, status: 'ACTIVE', ownerId: otherUser.id },
      });
      await prisma.venue.create({
        data: { organizationId: otherOrg.id, name: 'Other Venue', address: 'Av. X', city: 'BH', state: 'MG', country: 'BR' },
      });

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((v: { organizationId: string }) => v.organizationId === organizationId)).toBe(true);

      await prisma.venue.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('returns 400 for invalid organizationId UUID', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${INVALID_UUID}/venues`)
        .set('X-Dev-User-Id', testUserId)
        .expect(400);
    });

    it('returns 401 when header is missing', async () => {
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/venues`)
        .expect(401);
    });

    it('returns 404 when actor is not a member', async () => {
      const stranger = await prisma.user.create({
        data: { email: `sv-${Date.now()}@test.com`, displayName: 'S' },
      });
      await supertest(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/venues`)
        .set('X-Dev-User-Id', stranger.id)
        .expect(404);
      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });
});
