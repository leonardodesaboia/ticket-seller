import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawnSync } from 'child_process';
import { DatabaseModule } from '../../../src/platform/database/prisma.module';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import { PrismaInventoryRepository } from '../../../src/modules/inventory/infrastructure/repositories/prisma-inventory.repository';
import { InsufficientInventoryError } from '../../../src/modules/inventory/domain/inventory.errors';

let container: StartedPostgreSqlContainer;
let testingModule: TestingModule;
let prisma: PrismaService;
let repository: PrismaInventoryRepository;

let orgId: string;
let eventId: string;

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

  testingModule = await Test.createTestingModule({
    imports: [DatabaseModule],
    providers: [PrismaInventoryRepository],
  }).compile();

  prisma = testingModule.get(PrismaService);
  repository = testingModule.get(PrismaInventoryRepository);
  await testingModule.init();
}, 120000);

afterAll(async () => {
  await testingModule?.close();
  await container?.stop();
});

beforeEach(async () => {
  const owner = await prisma.user.create({
    data: { email: `concurrent-${Date.now()}@test.com`, displayName: 'Concurrent Owner' },
  });
  const org = await prisma.organization.create({
    data: {
      name: 'Concurrent Org',
      slug: `concurrent-${Date.now()}`,
      status: 'ACTIVE',
      ownerId: owner.id,
    },
  });
  orgId = org.id;

  const event = await prisma.event.create({
    data: { organizationId: orgId, title: 'Concurrent Event', status: 'DRAFT' },
  });
  eventId = event.id;
});

afterEach(async () => {
  await prisma.$executeRaw`DELETE FROM ticket_inventory`;
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

describe('PrismaInventoryRepository — concurrency', () => {
  it('ensures exactly one of two concurrent over-capacity reservations wins', async () => {
    const tt = await prisma.ticketType.create({
      data: {
        eventId,
        organizationId: orgId,
        name: 'General',
        priceAmount: 5000,
        capacity: 10,
        status: 'ACTIVE',
      },
    });
    const ticketTypeId = tt.id;

    await repository.initializeForEvent([
      { ticketTypeId, eventId, organizationId: orgId, capacity: 10 },
    ]);

    // Both attempts try to reserve 7, but only 10 total is available.
    // Exactly one should succeed, the other must fail with InsufficientInventoryError.
    const results = await Promise.allSettled([
      repository.tryReserve(orgId, ticketTypeId, 7),
      repository.tryReserve(orgId, ticketTypeId, 7),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof InsufficientInventoryError,
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Verify the final reserved value in the DB
    const inventory = await repository.findByTicketTypeId(orgId, ticketTypeId);
    expect(inventory).not.toBeNull();
    expect(inventory!.reserved).toBe(7);
  });

  it('allows multiple concurrent reservations that together do not exceed capacity', async () => {
    const tt = await prisma.ticketType.create({
      data: {
        eventId,
        organizationId: orgId,
        name: 'VIP',
        priceAmount: 10000,
        capacity: 20,
        status: 'ACTIVE',
      },
    });
    const ticketTypeId = tt.id;

    await repository.initializeForEvent([
      { ticketTypeId, eventId, organizationId: orgId, capacity: 20 },
    ]);

    // Each reserves 5; total = 15, within capacity of 20
    const results = await Promise.allSettled([
      repository.tryReserve(orgId, ticketTypeId, 5),
      repository.tryReserve(orgId, ticketTypeId, 5),
      repository.tryReserve(orgId, ticketTypeId, 5),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes).toHaveLength(3);

    const inventory = await repository.findByTicketTypeId(orgId, ticketTypeId);
    expect(inventory!.reserved).toBe(15);
    expect(inventory!.available).toBe(5);
  });
});
