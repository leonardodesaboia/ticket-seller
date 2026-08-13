import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawnSync } from 'child_process';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/platform/database/prisma.service';
import { HttpExceptionFilter } from '../../src/platform/http/filters/http-exception.filter';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;

const INVALID_UUID = 'not-a-valid-uuid';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  process.env['DATABASE_URL'] = url;
  const migration = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' },
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

describe('Publication Readiness API', () => {
  let ownerId: string;
  let organizationId: string;

  beforeEach(async () => {
    const owner = await prisma.user.create({
      data: { email: `readiness-${Date.now()}@test.com`, displayName: 'Readiness Owner' },
    });
    ownerId = owner.id;
    const organization = await prisma.organization.create({
      data: {
        name: 'Readiness Org',
        slug: `readiness-${Date.now()}`,
        status: 'ACTIVE',
        ownerId,
      },
    });
    organizationId = organization.id;
    await prisma.organizationMember.create({
      data: { organizationId, userId: ownerId, role: 'OWNER', status: 'ACTIVE' },
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

  async function createReadyEvent(): Promise<string> {
    const venue = await prisma.venue.create({
      data: {
        organizationId,
        name: 'Main Venue',
        address: 'Street 1',
        city: 'Fortaleza',
        state: 'CE',
        country: 'BR',
      },
    });
    const event = await prisma.event.create({
      data: {
        organizationId,
        title: 'Ready Event',
        status: 'DRAFT',
        version: 4,
        format: 'IN_PERSON',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
        timezone: 'America/Fortaleza',
        venueId: venue.id,
        currency: 'BRL',
      },
    });
    await prisma.ticketType.create({
      data: {
        eventId: event.id,
        organizationId,
        name: 'General',
        priceAmount: 5000,
        capacity: 100,
        status: 'ACTIVE',
      },
    });
    return event.id;
  }

  const getReadiness = (eventId: string, userId = ownerId, orgId = organizationId) =>
    supertest(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/events/${eventId}/publication-readiness`)
      .set('X-Dev-User-Id', userId);

  it('returns ready for a fully configured event', async () => {
    const eventId = await createReadyEvent();

    const response = await getReadiness(eventId).expect(200);

    expect(response.body).toEqual({ ready: true, version: 4, issues: [] });
    expect(response.body).not.toHaveProperty('onlineInfo');
  });

  it('returns deterministic multiple issues for an incomplete event', async () => {
    const event = await prisma.event.create({
      data: { organizationId, title: ' ', status: 'DRAFT' },
    });

    const response = await getReadiness(event.id).expect(200);

    expect(response.body.ready).toBe(false);
    expect(response.body.issues.map((issue: { code: string }) => issue.code)).toEqual([
      'EVENT_TITLE_REQUIRED',
      'EVENT_FORMAT_REQUIRED',
      'EVENT_STARTS_AT_REQUIRED',
      'EVENT_ENDS_AT_REQUIRED',
      'EVENT_TIMEZONE_REQUIRED',
      'EVENT_CURRENCY_REQUIRED',
      'TICKET_TYPE_ACTIVE_REQUIRED',
    ]);
  });

  it('returns EVENT_NOT_DRAFT for an already published event', async () => {
    const eventId = await createReadyEvent();
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED', slug: `published-${eventId}`, publishedAt: new Date() },
    });

    const response = await getReadiness(eventId).expect(200);

    expect(response.body.ready).toBe(false);
    expect(response.body.issues.map((issue: { code: string }) => issue.code)).toEqual([
      'EVENT_NOT_DRAFT',
    ]);
  });

  it('returns ORGANIZATION_NOT_ACTIVE without hiding the event from an active member', async () => {
    const eventId = await createReadyEvent();
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'SUSPENDED' },
    });

    const response = await getReadiness(eventId).expect(200);

    expect(response.body.issues.map((issue: { code: string }) => issue.code)).toEqual([
      'ORGANIZATION_NOT_ACTIVE',
    ]);
  });

  it('returns 403 for an insufficient role', async () => {
    const eventId = await createReadyEvent();
    const viewer = await prisma.user.create({
      data: { email: `readiness-viewer-${Date.now()}@test.com`, displayName: 'Viewer' },
    });
    await prisma.organizationMember.create({
      data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
    });

    await getReadiness(eventId, viewer.id).expect(403);
  });

  it('returns 404 for a non-member', async () => {
    const eventId = await createReadyEvent();
    const outsider = await prisma.user.create({
      data: { email: `readiness-outsider-${Date.now()}@test.com`, displayName: 'Outsider' },
    });

    await getReadiness(eventId, outsider.id).expect(404);
  });

  it('returns 404 for cross-tenant event access', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Other Org',
        slug: `readiness-other-${Date.now()}`,
        status: 'ACTIVE',
        ownerId,
      },
    });
    const otherEvent = await prisma.event.create({
      data: { organizationId: otherOrganization.id, title: 'Other Event', status: 'DRAFT' },
    });

    await getReadiness(otherEvent.id).expect(404);
  });

  it('returns 400 for invalid UUIDs', async () => {
    await getReadiness(INVALID_UUID).expect(400);
    await getReadiness(NONEXISTENT_UUID, ownerId, INVALID_UUID).expect(400);
  });

  it('returns 404 for a valid but nonexistent event UUID', async () => {
    await getReadiness(NONEXISTENT_UUID).expect(404);
  });
});
