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

const HOUR = 60 * 60 * 1000;

describe('Public Event Catalog API', () => {
  let organizationId: string;

  beforeEach(async () => {
    const owner = await prisma.user.create({
      data: { email: `public-${Date.now()}@test.com`, displayName: 'Public Owner' },
    });
    const organization = await prisma.organization.create({
      data: {
        name: 'Public Org',
        slug: `public-${Date.now()}`,
        status: 'ACTIVE',
        ownerId: owner.id,
      },
    });
    organizationId = organization.id;
  });

  afterEach(async () => {
    await prisma.ticketType.deleteMany();
    await prisma.event.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  async function createPublishedEvent(overrides: {
    slug: string;
    title?: string;
    format?: string;
    startsAt: Date;
    endsAt: Date;
    withVenue?: boolean;
    onlineInfo?: string | null;
    ticketTypes?: Array<{ name: string; priceAmount: number; status: string }>;
  }): Promise<string> {
    let venueId: string | undefined;
    if (overrides.withVenue) {
      const venue = await prisma.venue.create({
        data: {
          organizationId,
          name: 'Public Venue',
          address: '123 Secret Street',
          city: 'Fortaleza',
          state: 'CE',
          country: 'BR',
          postalCode: '60000-000',
        },
      });
      venueId = venue.id;
    }
    const event = await prisma.event.create({
      data: {
        organizationId,
        title: overrides.title ?? 'Published Event',
        status: 'PUBLISHED',
        version: 5,
        format: overrides.format ?? 'IN_PERSON',
        startsAt: overrides.startsAt,
        endsAt: overrides.endsAt,
        timezone: 'America/Fortaleza',
        currency: 'BRL',
        slug: overrides.slug,
        publishedAt: new Date(),
        ...(venueId && { venueId }),
        ...(overrides.onlineInfo !== undefined && { onlineInfo: overrides.onlineInfo }),
      },
    });
    const ticketTypes = overrides.ticketTypes ?? [
      { name: 'General', priceAmount: 5000, status: 'ACTIVE' },
    ];
    for (const ticketType of ticketTypes) {
      await prisma.ticketType.create({
        data: {
          eventId: event.id,
          organizationId,
          name: ticketType.name,
          priceAmount: ticketType.priceAmount,
          capacity: 100,
          status: ticketType.status,
        },
      });
    }
    return event.id;
  }

  const list = (query = '') => supertest(app.getHttpServer()).get(`/api/v1/public/events${query}`);
  const detail = (slug: string) =>
    supertest(app.getHttpServer()).get(`/api/v1/public/events/${slug}`);

  it('lists only published, in-progress/future events without authentication', async () => {
    await createPublishedEvent({
      slug: 'future-evt',
      startsAt: new Date(Date.now() + HOUR),
      endsAt: new Date(Date.now() + 2 * HOUR),
    });
    // DRAFT must never appear
    await prisma.event.create({
      data: {
        organizationId,
        title: 'Draft',
        status: 'DRAFT',
        startsAt: new Date(Date.now() + HOUR),
        endsAt: new Date(Date.now() + 2 * HOUR),
      },
    });
    // Past published event must not appear in the LISTING
    await createPublishedEvent({
      slug: 'past-evt',
      startsAt: new Date(Date.now() - 3 * HOUR),
      endsAt: new Date(Date.now() - 2 * HOUR),
    });

    const response = await list().expect(200);

    expect(response.headers['cache-control']).toBe(
      'public, max-age=60, stale-while-revalidate=300',
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].slug).toBe('future-evt');
    // Lean list item: no venue, ticketTypes, ids or private data
    expect(response.body.data[0]).toEqual({
      slug: 'future-evt',
      title: 'Published Event',
      format: 'IN_PERSON',
      startsAt: expect.any(String),
      endsAt: expect.any(String),
      timezone: 'America/Fortaleza',
      currency: 'BRL',
    });
  });

  it('orders by startsAt ASC, id ASC and paginates with an opaque cursor', async () => {
    for (let i = 1; i <= 3; i++) {
      await createPublishedEvent({
        slug: `evt-${i}`,
        title: `Event ${i}`,
        startsAt: new Date(Date.now() + i * HOUR),
        endsAt: new Date(Date.now() + (i + 5) * HOUR),
      });
    }

    const page1 = await list('?limit=2').expect(200);
    expect(page1.body.data.map((e: { slug: string }) => e.slug)).toEqual(['evt-1', 'evt-2']);
    expect(page1.body.nextCursor).toEqual(expect.any(String));

    const page2 = await list(`?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`).expect(
      200,
    );
    expect(page2.body.data.map((e: { slug: string }) => e.slug)).toEqual(['evt-3']);
    expect(page2.body.nextCursor).toBeNull();
  });

  it('paginates without skips or duplicates when events share the same startsAt', async () => {
    // All five events share the exact same startsAt so the keyset tie-break on
    // id is the only thing preventing skips/duplicates across page boundaries.
    const sharedStart = new Date(Date.now() + HOUR);
    const sharedEnd = new Date(Date.now() + 3 * HOUR);
    for (let i = 1; i <= 5; i++) {
      await createPublishedEvent({
        slug: `tie-${i}`,
        title: `Tie ${i}`,
        startsAt: sharedStart,
        endsAt: sharedEnd,
      });
    }

    const collected: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const query: string = cursor ? `?limit=2&cursor=${encodeURIComponent(cursor)}` : '?limit=2';
      const response = await list(query).expect(200);
      collected.push(...response.body.data.map((e: { slug: string }) => e.slug));
      cursor = response.body.nextCursor;
      if (!cursor) break;
    }

    expect(collected).toHaveLength(5);
    expect(new Set(collected).size).toBe(5); // no duplicates
    expect([...collected].sort()).toEqual(['tie-1', 'tie-2', 'tie-3', 'tie-4', 'tie-5']);
  });

  it('returns 400 for a malformed cursor', async () => {
    await list('?cursor=not-a-valid-cursor%20%21').expect(400);
  });

  it('returns the full public detail for the three formats, including after the event ended', async () => {
    await createPublishedEvent({
      slug: 'in-person-evt',
      format: 'IN_PERSON',
      startsAt: new Date(Date.now() - 3 * HOUR),
      endsAt: new Date(Date.now() - 2 * HOUR),
      withVenue: true,
      // Inserted out of price order to prove the adapter sorts by price asc.
      ticketTypes: [
        { name: 'VIP', priceAmount: 15000, status: 'ACTIVE' },
        { name: 'General', priceAmount: 5000, status: 'ACTIVE' },
        { name: 'Old', priceAmount: 1000, status: 'INACTIVE' },
      ],
    });
    await createPublishedEvent({
      slug: 'online-evt',
      format: 'ONLINE',
      startsAt: new Date(Date.now() + HOUR),
      endsAt: new Date(Date.now() + 2 * HOUR),
      onlineInfo: 'https://secret.example/live',
    });
    await createPublishedEvent({
      slug: 'hybrid-evt',
      format: 'HYBRID',
      startsAt: new Date(Date.now() + HOUR),
      endsAt: new Date(Date.now() + 2 * HOUR),
      withVenue: true,
      onlineInfo: 'https://secret.example/hybrid',
    });

    // Detail accessible after the event ended
    const past = await detail('in-person-evt').expect(200);
    expect(past.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=300');
    expect(past.body).toEqual({
      slug: 'in-person-evt',
      title: 'Published Event',
      description: null,
      format: 'IN_PERSON',
      startsAt: expect.any(String),
      endsAt: expect.any(String),
      timezone: 'America/Fortaleza',
      currency: 'BRL',
      venue: { name: 'Public Venue', city: 'Fortaleza', state: 'CE', country: 'BR' },
      ticketTypes: [
        { name: 'General', description: null, price: 5000, currency: 'BRL' },
        { name: 'VIP', description: null, price: 15000, currency: 'BRL' },
      ],
    });
    // Inactive ticket type excluded; no capacity/version/id/address exposed
    const serialized = JSON.stringify(past.body);
    expect(serialized).not.toContain('Old');
    expect(serialized).not.toContain('capacity');
    expect(serialized).not.toContain('Secret Street');
    expect(past.body.venue).not.toHaveProperty('address');

    const online = await detail('online-evt').expect(200);
    expect(online.body.format).toBe('ONLINE');
    expect(online.body.venue).toBeNull();

    const hybrid = await detail('hybrid-evt').expect(200);
    expect(hybrid.body.format).toBe('HYBRID');
    expect(JSON.stringify(hybrid.body)).not.toContain('secret.example');
    expect(JSON.stringify(online.body)).not.toContain('secret.example');
  });

  it('returns an indistinguishable 404 for missing slug and for a DRAFT event', async () => {
    const draft = await prisma.event.create({
      data: { organizationId, title: 'Draft', status: 'DRAFT', slug: 'draft-evt' },
    });
    expect(draft.id).toBeDefined();

    const missing = await detail('does-not-exist').expect(404);
    const draftResponse = await detail('draft-evt').expect(404);

    expect(draftResponse.body.status).toBe(404);
    expect(draftResponse.body.detail).toBe(missing.body.detail);
  });

  it('never exposes onlineInfo in the listing', async () => {
    await createPublishedEvent({
      slug: 'online-list-evt',
      format: 'ONLINE',
      startsAt: new Date(Date.now() + HOUR),
      endsAt: new Date(Date.now() + 2 * HOUR),
      onlineInfo: 'https://secret.example/live',
    });

    const response = await list().expect(200);

    expect(JSON.stringify(response.body)).not.toContain('secret.example');
    expect(response.body.data[0]).not.toHaveProperty('onlineInfo');
  });
});
