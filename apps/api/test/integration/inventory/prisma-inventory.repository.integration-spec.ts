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

// Test data holders
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
  // Create base entities
  const owner = await prisma.user.create({
    data: { email: `inv-repo-${Date.now()}@test.com`, displayName: 'Inv Owner' },
  });
  const org = await prisma.organization.create({
    data: { name: 'Inv Org', slug: `inv-repo-${Date.now()}`, status: 'ACTIVE', ownerId: owner.id },
  });
  orgId = org.id;

  const event = await prisma.event.create({
    data: { organizationId: orgId, title: 'Inv Event', status: 'DRAFT' },
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

async function createTicketType(capacity = 100): Promise<string> {
  const tt = await prisma.ticketType.create({
    data: {
      eventId,
      organizationId: orgId,
      name: 'General',
      priceAmount: 5000,
      capacity,
      status: 'ACTIVE',
    },
  });
  return tt.id;
}

describe('PrismaInventoryRepository', () => {
  describe('initializeForEvent', () => {
    it('creates a ticket_inventory row for each ticket type', async () => {
      const ttId1 = await createTicketType(100);
      const ttId2 = await createTicketType(50);

      await repository.initializeForEvent([
        { ticketTypeId: ttId1, eventId, organizationId: orgId, capacity: 100 },
        { ticketTypeId: ttId2, eventId, organizationId: orgId, capacity: 50 },
      ]);

      const rows = await repository.findByEventId(orgId, eventId);
      expect(rows).toHaveLength(2);
      const ttIds = rows.map((r) => r.ticketTypeId).sort();
      expect(ttIds).toEqual([ttId1, ttId2].sort());
    });

    it('sets capacity correctly and reserved/committed to 0', async () => {
      const ttId = await createTicketType(75);

      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 75 },
      ]);

      const inventory = await repository.findByTicketTypeId(orgId, ttId);
      expect(inventory).not.toBeNull();
      expect(inventory!.capacity).toBe(75);
      expect(inventory!.reserved).toBe(0);
      expect(inventory!.committed).toBe(0);
      expect(inventory!.available).toBe(75);
    });

    it('is idempotent — ON CONFLICT DO NOTHING prevents duplicate rows', async () => {
      const ttId = await createTicketType(100);
      const item = { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 100 };

      await repository.initializeForEvent([item]);
      await repository.initializeForEvent([item]); // second call should be silent

      const rows = await repository.findByEventId(orgId, eventId);
      expect(rows).toHaveLength(1);
    });

    it('does nothing when items is empty', async () => {
      await expect(repository.initializeForEvent([])).resolves.toBeUndefined();
    });
  });

  describe('getAvailability', () => {
    it('returns capacity - committed for a freshly initialized event', async () => {
      const ttId = await createTicketType(100);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 100 },
      ]);

      const result = await repository.getAvailability([ttId], orgId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ticketTypeId: ttId,
        availableQuantity: 100,
      });
    });

    it('returns empty array for empty input', async () => {
      const result = await repository.getAvailability([], orgId);
      expect(result).toEqual([]);
    });

    it('returns only matching ticket types', async () => {
      const ttId = await createTicketType(60);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 60 },
      ]);
      const nonExistentId = '00000000-0000-0000-0000-000000000001';

      const result = await repository.getAvailability([ttId, nonExistentId], orgId);
      expect(result).toHaveLength(1);
      expect(result[0]!.ticketTypeId).toBe(ttId);
    });

    it('does not return inventory from a different organization', async () => {
      const ttId = await createTicketType(80);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 80 },
      ]);
      const wrongOrgId = '00000000-0000-0000-0000-000000000099';

      const result = await repository.getAvailability([ttId], wrongOrgId);
      expect(result).toEqual([]);
    });
  });

  describe('tenant isolation', () => {
    it('findByTicketTypeId returns null when called with a wrong organizationId', async () => {
      const ttId = await createTicketType(100);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 100 },
      ]);
      const wrongOrgId = '00000000-0000-0000-0000-000000000099';

      const result = await repository.findByTicketTypeId(wrongOrgId, ttId);
      expect(result).toBeNull();
    });

    it('findByEventId returns empty array when called with a wrong organizationId', async () => {
      const ttId = await createTicketType(100);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 100 },
      ]);
      const wrongOrgId = '00000000-0000-0000-0000-000000000099';

      const result = await repository.findByEventId(wrongOrgId, eventId);
      expect(result).toEqual([]);
    });
  });

  describe('CHECK constraints', () => {
    it('rejects reserved + committed > capacity via direct DB constraint', async () => {
      const ttId = await createTicketType(10);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 10 },
      ]);

      // Attempt to violate the constraint directly
      await expect(
        prisma.$executeRaw`
          UPDATE ticket_inventory
          SET reserved = 8, committed = 5
          WHERE ticket_type_id = ${ttId}::uuid
        `,
      ).rejects.toThrow();
    });

    it('rejects reserved + committed = capacity + 1 (boundary)', async () => {
      const ttId = await createTicketType(10);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 10 },
      ]);

      await expect(
        prisma.$executeRaw`
          UPDATE ticket_inventory
          SET reserved = 10, committed = 1
          WHERE ticket_type_id = ${ttId}::uuid
        `,
      ).rejects.toThrow();
    });
  });

  describe('UNIQUE constraint on ticket_type_id', () => {
    it('prevents two inventory rows for the same ticket type', async () => {
      const ttId = await createTicketType(100);

      await expect(
        prisma.$executeRaw`
          INSERT INTO ticket_inventory (ticket_type_id, event_id, organization_id, capacity)
          VALUES (${ttId}::uuid, ${eventId}::uuid, ${orgId}::uuid, 100)
        `,
      ).resolves.toBe(1);

      await expect(
        prisma.$executeRaw`
          INSERT INTO ticket_inventory (ticket_type_id, event_id, organization_id, capacity)
          VALUES (${ttId}::uuid, ${eventId}::uuid, ${orgId}::uuid, 50)
        `,
      ).rejects.toThrow();
    });
  });

  describe('tryReserve', () => {
    it('increments reserved when there is sufficient availability', async () => {
      const ttId = await createTicketType(100);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 100 },
      ]);

      const result = await repository.tryReserve(orgId, ttId, 10);

      expect(result.reserved).toBe(10);
      expect(result.available).toBe(90);
      expect(result.version).toBe(2);
    });

    it('throws InsufficientInventoryError when not enough availability', async () => {
      const ttId = await createTicketType(5);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 5 },
      ]);

      await expect(repository.tryReserve(orgId, ttId, 6)).rejects.toThrow(
        InsufficientInventoryError,
      );
    });

    it('throws InsufficientInventoryError for exact capacity overflow', async () => {
      const ttId = await createTicketType(10);
      await repository.initializeForEvent([
        { ticketTypeId: ttId, eventId, organizationId: orgId, capacity: 10 },
      ]);
      await repository.tryReserve(orgId, ttId, 10); // reserve all

      await expect(repository.tryReserve(orgId, ttId, 1)).rejects.toThrow(
        InsufficientInventoryError,
      );
    });
  });
});
