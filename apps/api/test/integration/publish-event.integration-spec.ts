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

describe('Publish Event API', () => {
  let ownerId: string;
  let organizationId: string;

  beforeEach(async () => {
    const owner = await prisma.user.create({
      data: { email: `publish-${Date.now()}@test.com`, displayName: 'Publish Owner' },
    });
    ownerId = owner.id;
    const organization = await prisma.organization.create({
      data: {
        name: 'Publish Org',
        slug: `publish-${Date.now()}`,
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
    await prisma.auditEntry.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.$executeRaw`DELETE FROM ticket_inventory`;
    await prisma.ticketType.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.event.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  async function createReadyEvent(
    overrides: { title?: string; onlineInfo?: string | null } = {},
  ): Promise<string> {
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
        title: overrides.title ?? 'Ready Event',
        status: 'DRAFT',
        version: 4,
        format: 'IN_PERSON',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
        timezone: 'America/Fortaleza',
        venueId: venue.id,
        currency: 'BRL',
        ...(overrides.onlineInfo !== undefined && { onlineInfo: overrides.onlineInfo }),
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

  const publish = (
    eventId: string,
    body: { version: number },
    options: { userId?: string; orgId?: string; key?: string | null } = {},
  ) => {
    const request = supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${options.orgId ?? organizationId}/events/${eventId}/publish`)
      .set('X-Dev-User-Id', options.userId ?? ownerId);
    if (options.key !== null) {
      request.set('Idempotency-Key', options.key ?? `publish-key-${eventId}`);
    }
    return request.send(body);
  };

  it('publishes a ready draft event atomically', async () => {
    const eventId = await createReadyEvent();

    const response = await publish(eventId, { version: 4 }).expect(200);

    expect(response.body).toMatchObject({
      id: eventId,
      status: 'PUBLISHED',
      version: 5,
      onlineConfigured: false,
    });
    expect(response.body.slug).toMatch(new RegExp(`^ready-event-${eventId}$`));
    expect(typeof response.body.publishedAt).toBe('string');
    expect(response.body).not.toHaveProperty('onlineInfo');

    const persisted = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(persisted.status).toBe('PUBLISHED');
    expect(persisted.version).toBe(5);
    expect(persisted.slug).toBe(response.body.slug);
    expect(persisted.publishedAt).not.toBeNull();

    const outbox = await prisma.outboxEvent.findMany({ where: { type: 'event.published.v1' } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.payload).toMatchObject({
      eventId,
      organizationId,
      version: 5,
      slug: response.body.slug,
    });
    expect(JSON.stringify(outbox[0]?.payload)).not.toContain('onlineInfo');

    const audit = await prisma.auditEntry.findMany({ where: { action: 'event.published' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      organizationId,
      userId: ownerId,
      resourceType: 'event',
      resourceId: eventId,
    });
  });

  it('never exposes onlineInfo even when configured', async () => {
    const eventId = await createReadyEvent({ onlineInfo: 'https://secret.example/live' });

    const response = await publish(eventId, { version: 4 }).expect(200);

    expect(response.body.onlineConfigured).toBe(true);
    expect(response.body).not.toHaveProperty('onlineInfo');
    const outbox = await prisma.outboxEvent.findMany({ where: { type: 'event.published.v1' } });
    expect(JSON.stringify(outbox[0]?.payload)).not.toContain('secret.example');
    const audit = await prisma.auditEntry.findMany({ where: { action: 'event.published' } });
    expect(JSON.stringify(audit[0]?.metadata)).not.toContain('secret.example');
  });

  it('returns 422 with version and issues for an incomplete event', async () => {
    const event = await prisma.event.create({
      data: { organizationId, title: ' ', status: 'DRAFT', version: 1 },
    });

    const response = await publish(event.id, { version: 1 }).expect(422);

    expect(response.body.code).toBe('EVENT_PUBLICATION_NOT_READY');
    expect(response.body.version).toBe(1);
    expect(Array.isArray(response.body.issues)).toBe(true);
    expect(response.body.issues.map((issue: { code: string }) => issue.code)).toContain(
      'EVENT_TITLE_REQUIRED',
    );

    const persisted = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(persisted.status).toBe('DRAFT');
    expect(persisted.version).toBe(1);
    const idempotency = await prisma.idempotencyRecord.findMany();
    expect(idempotency).toHaveLength(0);
  });

  it('returns 409 EVENT_VERSION_CONFLICT for a stale version', async () => {
    const eventId = await createReadyEvent();

    const response = await publish(eventId, { version: 3 }).expect(409);

    expect(response.body.code).toBe('EVENT_VERSION_CONFLICT');
    const persisted = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(persisted.status).toBe('DRAFT');
  });

  it('returns 409 EVENT_NOT_DRAFT when the event is already published', async () => {
    const eventId = await createReadyEvent();
    await publish(eventId, { version: 4 }, { key: 'first-publish' }).expect(200);

    const response = await publish(eventId, { version: 5 }, { key: 'second-publish' }).expect(409);

    expect(response.body.code).toBe('EVENT_NOT_DRAFT');
    const persisted = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(persisted.version).toBe(5);
  });

  it('scopes the idempotency key to the actor so another member cannot replay it', async () => {
    const eventId = await createReadyEvent();
    const admin = await prisma.user.create({
      data: { email: `publish-admin-${Date.now()}@test.com`, displayName: 'Admin' },
    });
    await prisma.organizationMember.create({
      data: { organizationId, userId: admin.id, role: 'ADMIN', status: 'ACTIVE' },
    });

    await publish(eventId, { version: 4 }, { key: 'shared-actor-key' }).expect(200);

    // The same key from a different authorized member is a fresh attempt, not a
    // replay of the first actor's confirmed response.
    const response = await publish(
      eventId,
      { version: 5 },
      {
        key: 'shared-actor-key',
        userId: admin.id,
      },
    ).expect(409);

    expect(response.body.code).toBe('EVENT_NOT_DRAFT');
    const audit = await prisma.auditEntry.findMany({ where: { action: 'event.published' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.userId).toBe(ownerId);
  });

  it('replays the confirmed response for a repeated idempotency key', async () => {
    const eventId = await createReadyEvent();

    const first = await publish(eventId, { version: 4 }, { key: 'replay-key' }).expect(200);
    const second = await publish(eventId, { version: 4 }, { key: 'replay-key' }).expect(200);

    expect(second.body).toEqual(first.body);
    const persisted = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(persisted.version).toBe(5);
    const outbox = await prisma.outboxEvent.findMany({ where: { type: 'event.published.v1' } });
    expect(outbox).toHaveLength(1);
    const audit = await prisma.auditEntry.findMany({ where: { action: 'event.published' } });
    expect(audit).toHaveLength(1);
  });

  it('returns 409 IDEMPOTENCY_KEY_REUSED for a different payload with the same key', async () => {
    const eventId = await createReadyEvent();
    await publish(eventId, { version: 4 }, { key: 'shared-key' }).expect(200);

    const response = await publish(eventId, { version: 5 }, { key: 'shared-key' }).expect(409);

    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('returns 422 for a missing Idempotency-Key', async () => {
    const eventId = await createReadyEvent();

    await publish(eventId, { version: 4 }, { key: null }).expect(422);
  });

  it('returns 403 for an insufficient role', async () => {
    const eventId = await createReadyEvent();
    const viewer = await prisma.user.create({
      data: { email: `publish-viewer-${Date.now()}@test.com`, displayName: 'Viewer' },
    });
    await prisma.organizationMember.create({
      data: { organizationId, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
    });

    await publish(eventId, { version: 4 }, { userId: viewer.id }).expect(403);
  });

  it('returns 404 for a non-member', async () => {
    const eventId = await createReadyEvent();
    const outsider = await prisma.user.create({
      data: { email: `publish-outsider-${Date.now()}@test.com`, displayName: 'Outsider' },
    });

    await publish(eventId, { version: 4 }, { userId: outsider.id }).expect(404);
  });

  it('returns 404 for cross-tenant access', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Other Org',
        slug: `publish-other-${Date.now()}`,
        status: 'ACTIVE',
        ownerId,
      },
    });
    const otherEvent = await prisma.event.create({
      data: { organizationId: otherOrganization.id, title: 'Other Event', status: 'DRAFT' },
    });

    await publish(otherEvent.id, { version: 1 }).expect(404);
  });

  it('returns 400 for invalid UUIDs', async () => {
    await publish(INVALID_UUID, { version: 4 }).expect(400);
  });

  it('returns 404 for a valid but nonexistent event UUID', async () => {
    await publish(NONEXISTENT_UUID, { version: 4 }).expect(404);
  });
});
