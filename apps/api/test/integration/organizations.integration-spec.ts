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

describe('POST /api/v1/organizations', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `owner-${Date.now()}@test.com`, displayName: 'Test Owner' },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    await prisma.outboxEvent.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it('returns 201 and creates organization with OWNER member', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('X-Dev-User-Id', testUserId)
      .send({ name: 'Acme Events', slug: 'acme-events' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Acme Events',
      slug: 'acme-events',
      status: 'ACTIVE',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();

    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: res.body.id as string, userId: testUserId },
    });
    expect(member?.role).toBe('OWNER');
    expect(member?.status).toBe('ACTIVE');
  });

  it('returns 409 when slug is already in use', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('X-Dev-User-Id', testUserId)
      .send({ name: 'First Org', slug: 'my-slug' })
      .expect(201);

    await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('X-Dev-User-Id', testUserId)
      .send({ name: 'Second Org', slug: 'my-slug' })
      .expect(409);
  });

  it('returns 401 when X-Dev-User-Id header is missing', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ name: 'Acme', slug: 'acme' })
      .expect(401);
  });

  it('returns 400 when name is empty', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('X-Dev-User-Id', testUserId)
      .send({ name: '', slug: 'valid-slug' })
      .expect(400);
  });

  it('returns 400 when slug has uppercase letters', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('X-Dev-User-Id', testUserId)
      .send({ name: 'Acme', slug: 'ACME' })
      .expect(400);
  });

  it('writes organization.created.v1 event to outbox', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('X-Dev-User-Id', testUserId)
      .send({ name: 'Outbox Test Org', slug: 'outbox-test' })
      .expect(201);

    const event = await prisma.outboxEvent.findFirst({
      where: { type: 'organization.created.v1', aggregateId: res.body.id as string },
    });
    expect(event).not.toBeNull();
    expect(event?.aggregateType).toBe('organization');
    expect(event?.organizationId).toBe(res.body.id as string);
  });
});
