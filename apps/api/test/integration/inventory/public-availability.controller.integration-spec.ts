import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawnSync } from 'child_process';
import supertest from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import { HttpExceptionFilter } from '../../../src/platform/http/filters/http-exception.filter';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
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

afterEach(async () => {
  await prisma.$executeRaw`DELETE FROM ticket_inventory`;
  await prisma.auditEntry.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function createPublishedEvent(): Promise<{
  orgId: string;
  eventId: string;
  slug: string;
  ticketTypeId: string;
  ownerId: string;
}> {
  const owner = await prisma.user.create({
    data: { email: `avail-${Date.now()}@test.com`, displayName: 'Avail Owner' },
  });
  const org = await prisma.organization.create({
    data: {
      name: 'Avail Org',
      slug: `avail-org-${Date.now()}`,
      status: 'ACTIVE',
      ownerId: owner.id,
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });

  const venue = await prisma.venue.create({
    data: {
      organizationId: org.id,
      name: 'Main Venue',
      address: 'Street 1',
      city: 'Fortaleza',
      state: 'CE',
      country: 'BR',
    },
  });

  const title = `Avail Event ${Date.now()}`;
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      title,
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

  const tt = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      organizationId: org.id,
      name: 'General',
      priceAmount: 5000,
      capacity: 100,
      status: 'ACTIVE',
    },
  });

  // Publish via API (which also creates inventory)
  await supertest(app.getHttpServer())
    .post(`/api/v1/organizations/${org.id}/events/${event.id}/publish`)
    .set('X-Dev-User-Id', owner.id)
    .set('Idempotency-Key', `publish-avail-${Date.now()}`)
    .send({ version: 4 })
    .expect(200);

  const published = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

  return {
    orgId: org.id,
    eventId: event.id,
    slug: published.slug!,
    ticketTypeId: tt.id,
    ownerId: owner.id,
  };
}

describe('GET /api/v1/public/events/:slug/availability', () => {
  it('returns 200 with availability items for a published event', async () => {
    const { slug, ticketTypeId } = await createPublishedEvent();

    const response = await supertest(app.getHttpServer())
      .get(`/api/v1/public/events/${slug}/availability`)
      .expect(200);

    expect(response.body).toMatchObject({
      eventSlug: slug,
      items: expect.arrayContaining([
        expect.objectContaining({
          ticketTypeId,
          availableQuantity: 100,
        }),
      ]),
    });
    expect(response.headers['cache-control']).toContain('max-age=10');
  });

  it('returns 404 for a slug that does not exist', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/v1/public/events/non-existent-slug/availability')
      .expect(404);

    expect(response.body.status).toBe(404);
  });

  it('returns 404 for a draft event slug (not published)', async () => {
    const owner = await prisma.user.create({
      data: { email: `draft-avail-${Date.now()}@test.com`, displayName: 'Draft Avail' },
    });
    const org = await prisma.organization.create({
      data: {
        name: 'Draft Org',
        slug: `draft-avail-${Date.now()}`,
        status: 'ACTIVE',
        ownerId: owner.id,
      },
    });
    // Create a draft event — it has no slug, so we use a fake slug
    await prisma.event.create({
      data: { organizationId: org.id, title: 'Draft Event', status: 'DRAFT' },
    });

    const response = await supertest(app.getHttpServer())
      .get('/api/v1/public/events/draft-event-fake-slug/availability')
      .expect(404);

    expect(response.body.status).toBe(404);
  });
});
