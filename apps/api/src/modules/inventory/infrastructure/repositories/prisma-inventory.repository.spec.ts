import { PrismaInventoryRepository } from './prisma-inventory.repository';
import { TicketInventory } from '../../domain/ticket-inventory.entity';
import { InsufficientInventoryError, InventoryNotFoundError } from '../../domain/inventory.errors';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const TICKET_TYPE_ID = '22222222-2222-2222-2222-222222222222';
const EVENT_ID = '33333333-3333-3333-3333-333333333333';
const INVENTORY_ID = '44444444-4444-4444-4444-444444444444';

function makeRawInventoryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: INVENTORY_ID,
    ticket_type_id: TICKET_TYPE_ID,
    event_id: EVENT_ID,
    organization_id: ORG_ID,
    capacity: 100,
    reserved: 10,
    committed: 5,
    version: 1,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makePrisma(queryRawResult: unknown[] = [], executeRawResult = 1) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(queryRawResult),
    $executeRaw: jest.fn().mockResolvedValue(executeRawResult),
    $transaction: jest.fn(),
  };
}

describe('PrismaInventoryRepository', () => {
  describe('getAvailability', () => {
    it('returns empty array when ticketTypeIds is empty', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaInventoryRepository(prisma as never);
      const result = await repo.getAvailability([], ORG_ID);
      expect(result).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns availability rows mapped to AvailabilityResult objects', async () => {
      const rawRows = [
        { ticket_type_id: TICKET_TYPE_ID, available_quantity: BigInt(85) },
        { ticket_type_id: '55555555-5555-5555-5555-555555555555', available_quantity: 42 },
      ];
      const prisma = makePrisma(rawRows);
      const repo = new PrismaInventoryRepository(prisma as never);
      const result = await repo.getAvailability([TICKET_TYPE_ID, '55555555-5555-5555-5555-555555555555'], ORG_ID);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ticketTypeId: TICKET_TYPE_ID, availableQuantity: 85 });
      expect(result[1]).toEqual({ ticketTypeId: '55555555-5555-5555-5555-555555555555', availableQuantity: 42 });
    });

    it('converts bigint available_quantity to number', async () => {
      const rawRows = [{ ticket_type_id: TICKET_TYPE_ID, available_quantity: BigInt(50) }];
      const prisma = makePrisma(rawRows);
      const repo = new PrismaInventoryRepository(prisma as never);
      const result = await repo.getAvailability([TICKET_TYPE_ID], ORG_ID);
      expect(typeof result[0]?.availableQuantity).toBe('number');
      expect(result[0]?.availableQuantity).toBe(50);
    });
  });

  describe('tryReserve', () => {
    it('returns TicketInventory entity when stock is sufficient', async () => {
      const updatedRow = makeRawInventoryRow({ reserved: 12, version: 2 });
      const prisma = makePrisma([updatedRow]);
      const repo = new PrismaInventoryRepository(prisma as never);
      const result = await repo.tryReserve(ORG_ID, TICKET_TYPE_ID, 2);
      expect(result).toBeInstanceOf(TicketInventory);
      expect(result.reserved).toBe(12);
      expect(result.version).toBe(2);
    });

    it('throws InsufficientInventoryError when UPDATE returns 0 rows (no stock)', async () => {
      const prisma = makePrisma([]); // 0 rows → insufficient
      const repo = new PrismaInventoryRepository(prisma as never);
      await expect(repo.tryReserve(ORG_ID, TICKET_TYPE_ID, 999)).rejects.toBeInstanceOf(
        InsufficientInventoryError,
      );
    });

    it('InsufficientInventoryError carries the ticketTypeId', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaInventoryRepository(prisma as never);
      try {
        await repo.tryReserve(ORG_ID, TICKET_TYPE_ID, 999);
        fail('Expected InsufficientInventoryError');
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientInventoryError);
        expect((err as InsufficientInventoryError).ticketTypeId).toBe(TICKET_TYPE_ID);
      }
    });
  });

  describe('releaseHold', () => {
    it('resolves immediately when exact decrement succeeds (affected >= quantity)', async () => {
      // exact path: first executeRaw returns 1
      const prisma = makePrisma([], 1);
      const repo = new PrismaInventoryRepository(prisma as never);
      await expect(repo.releaseHold(ORG_ID, TICKET_TYPE_ID, 5)).resolves.toBeUndefined();
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('falls back to reset-to-0 when exact decrement affects 0 rows (underflow guard)', async () => {
      // First call: exact path, 0 rows. Second call: fallback, 1 row.
      const prisma = {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        $transaction: jest.fn(),
      };
      const repo = new PrismaInventoryRepository(prisma as never);
      await expect(repo.releaseHold(ORG_ID, TICKET_TYPE_ID, 5)).resolves.toBeUndefined();
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('throws InventoryNotFoundError when both exact and fallback update affect 0 rows', async () => {
      const prisma = {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
        $transaction: jest.fn(),
      };
      const repo = new PrismaInventoryRepository(prisma as never);
      await expect(repo.releaseHold(ORG_ID, TICKET_TYPE_ID, 5)).rejects.toBeInstanceOf(
        InventoryNotFoundError,
      );
    });

    it('InventoryNotFoundError carries the ticketTypeId', async () => {
      const prisma = {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
        $transaction: jest.fn(),
      };
      const repo = new PrismaInventoryRepository(prisma as never);
      try {
        await repo.releaseHold(ORG_ID, TICKET_TYPE_ID, 5);
        fail('Expected InventoryNotFoundError');
      } catch (err) {
        expect(err).toBeInstanceOf(InventoryNotFoundError);
        expect((err as InventoryNotFoundError).ticketTypeId).toBe(TICKET_TYPE_ID);
      }
    });
  });
});
