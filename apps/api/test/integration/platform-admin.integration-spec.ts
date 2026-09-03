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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(options: {
  platformRole?: 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT';
  suffix?: string;
} = {}) {
  const suffix = options.suffix ?? String(Date.now());
  return prisma.user.create({
    data: {
      email: `user-${suffix}@test.com`,
      displayName: `Test User ${suffix}`,
      ...(options.platformRole ? { platformRole: options.platformRole } : {}),
    },
  });
}

async function createOrg(ownerId: string, slug?: string, extra: Record<string, unknown> = {}) {
  const s = slug ?? `org-${Date.now()}`;
  return prisma.organization.create({
    data: {
      name: `Org ${s}`,
      slug: s,
      status: 'ACTIVE',
      ownerId,
      ...extra,
    },
  });
}

async function cleanup() {
  await prisma.outboxEvent.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/dashboard
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/dashboard', () => {
  let adminUserId: string;
  let supportUserId: string;
  let plainUserId: string;

  beforeEach(async () => {
    const admin = await createUser({ platformRole: 'PLATFORM_ADMIN', suffix: `admin-${Date.now()}` });
    adminUserId = admin.id;
    const support = await createUser({ platformRole: 'PLATFORM_SUPPORT', suffix: `support-${Date.now() + 1}` });
    supportUserId = support.id;
    const plain = await createUser({ suffix: `plain-${Date.now() + 2}` });
    plainUserId = plain.id;
  });

  afterEach(cleanup);

  it('returns 200 with a PLATFORM_ADMIN token', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('X-Dev-User-Id', adminUserId)
      .expect(200);
  });

  it('returns 200 with a PLATFORM_SUPPORT token (role hierarchy allows read access)', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('X-Dev-User-Id', supportUserId)
      .expect(200);
  });

  it('returns 401 without a token', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .expect(401);
  });

  it('returns 403 when the user has no platform role', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('X-Dev-User-Id', plainUserId)
      .expect(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/users', () => {
  let adminUserId: string;

  beforeEach(async () => {
    const admin = await createUser({ platformRole: 'PLATFORM_ADMIN', suffix: `admin-${Date.now()}` });
    adminUserId = admin.id;
  });

  afterEach(cleanup);

  it('returns 401 without a token', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/admin/users')
      .expect(401);
  });

  it('returns 200 with items array and nextCursor field for admin', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('X-Dev-User-Id', adminUserId)
      .expect(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('returns null nextCursor when total users <= limit', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users?limit=100')
      .set('X-Dev-User-Id', adminUserId)
      .expect(200);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns non-null nextCursor when more items exist than the page limit', async () => {
    // Admin already exists; create two more to ensure at least 3 users total.
    await createUser({ suffix: `extra1-${Date.now()}` });
    await createUser({ suffix: `extra2-${Date.now() + 1}` });

    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users?limit=1')
      .set('X-Dev-User-Id', adminUserId)
      .expect(200);
    expect(res.body.nextCursor).not.toBeNull();
    expect(res.body.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/organizations/:id/suspend
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/organizations/:orgId/suspend', () => {
  let adminUserId: string;

  beforeEach(async () => {
    const admin = await createUser({ platformRole: 'PLATFORM_ADMIN', suffix: `admin-${Date.now()}` });
    adminUserId = admin.id;
  });

  afterEach(cleanup);

  it('returns 200 and suspends the organization (happy path)', async () => {
    const org = await createOrg(adminUserId);

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({ reason: 'Violation of terms of service' })
      .expect(200);

    expect(res.body).toEqual({ success: true });

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.suspendedAt).not.toBeNull();
  });

  it('is idempotent when the organization is already suspended (returns 200 without error)', async () => {
    const org = await createOrg(adminUserId, `suspended-${Date.now()}`, {
      suspendedAt: new Date(),
    });

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({ reason: 'Second suspend attempt is idempotent' })
      .expect(200);

    expect(res.body).toEqual({ success: true });
  });

  it('returns 404 when the organization does not exist', async () => {
    const nonExistentId = '00000000-0000-4000-a000-000000000001';
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${nonExistentId}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({ reason: 'Organization does not exist' })
      .expect(404);
  });

  it('returns 401 without a token', async () => {
    const org = await createOrg(adminUserId);
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/suspend`)
      .send({ reason: 'Unauthorized attempt to suspend' })
      .expect(401);
  });

  it('returns 403 for PLATFORM_SUPPORT (route requires PLATFORM_ADMIN)', async () => {
    const supportUser = await createUser({
      platformRole: 'PLATFORM_SUPPORT',
      suffix: `support-${Date.now()}`,
    });
    const org = await createOrg(adminUserId);

    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/suspend`)
      .set('X-Dev-User-Id', supportUser.id)
      .send({ reason: 'Support should not be allowed to suspend' })
      .expect(403);
  });

  it('returns 400 when reason is missing', async () => {
    const org = await createOrg(adminUserId);
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({})
      .expect(400);
  });

  it('returns 400 when reason is shorter than 10 characters', async () => {
    const org = await createOrg(adminUserId);
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({ reason: 'Short' })
      .expect(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/organizations/:id/unsuspend
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/organizations/:orgId/unsuspend', () => {
  let adminUserId: string;

  beforeEach(async () => {
    const admin = await createUser({ platformRole: 'PLATFORM_ADMIN', suffix: `admin-${Date.now()}` });
    adminUserId = admin.id;
  });

  afterEach(cleanup);

  it('returns 200 and reactivates the organization (happy path)', async () => {
    const org = await createOrg(adminUserId, `susp-${Date.now()}`, { suspendedAt: new Date() });

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/unsuspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({ reason: 'Appeals review cleared — reinstating organization' })
      .expect(200);

    expect(res.body).toEqual({ success: true });

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.suspendedAt).toBeNull();
  });

  it('returns 401 without a token', async () => {
    const org = await createOrg(adminUserId);
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/unsuspend`)
      .send({ reason: 'Unauthorized unsuspend attempt' })
      .expect(401);
  });

  it('returns 403 for PLATFORM_SUPPORT (route requires PLATFORM_ADMIN)', async () => {
    const supportUser = await createUser({
      platformRole: 'PLATFORM_SUPPORT',
      suffix: `support-${Date.now()}`,
    });
    const org = await createOrg(adminUserId);

    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/organizations/${org.id}/unsuspend`)
      .set('X-Dev-User-Id', supportUser.id)
      .send({ reason: 'Support should not be allowed to unsuspend' })
      .expect(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/users/:id/suspend
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/users/:userId/suspend', () => {
  let adminUserId: string;

  beforeEach(async () => {
    const admin = await createUser({ platformRole: 'PLATFORM_ADMIN', suffix: `admin-${Date.now()}` });
    adminUserId = admin.id;
  });

  afterEach(cleanup);

  it('returns 200 and suspends the user (happy path)', async () => {
    const targetUser = await createUser({ suffix: `target-${Date.now()}` });

    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUser.id}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({ reason: 'Repeated violations of platform rules' })
      .expect(200);

    expect(res.body).toEqual({ success: true });

    const updated = await prisma.user.findUnique({ where: { id: targetUser.id } });
    expect(updated?.suspendedAt).not.toBeNull();
  });

  it('returns 401 without a token', async () => {
    const targetUser = await createUser({ suffix: `target-${Date.now()}` });
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUser.id}/suspend`)
      .send({ reason: 'Unauthorized suspend attempt' })
      .expect(401);
  });

  it('returns 403 for PLATFORM_SUPPORT (route requires PLATFORM_ADMIN)', async () => {
    const supportUser = await createUser({
      platformRole: 'PLATFORM_SUPPORT',
      suffix: `support-${Date.now()}`,
    });
    const targetUser = await createUser({ suffix: `target-${Date.now() + 1}` });

    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUser.id}/suspend`)
      .set('X-Dev-User-Id', supportUser.id)
      .send({ reason: 'Support should not be able to suspend users' })
      .expect(403);
  });

  it('returns 400 when reason is missing', async () => {
    const targetUser = await createUser({ suffix: `target-${Date.now()}` });
    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUser.id}/suspend`)
      .set('X-Dev-User-Id', adminUserId)
      .send({})
      .expect(400);
  });
});
