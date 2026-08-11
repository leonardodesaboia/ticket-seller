import { TicketInventory } from './ticket-inventory.entity';

function makeInventory(overrides: Partial<ConstructorParameters<typeof TicketInventory>[0]> = {}): TicketInventory {
  return new TicketInventory({
    id: 'test-id',
    ticketTypeId: 'tt-id',
    eventId: 'event-id',
    organizationId: 'org-id',
    capacity: 100,
    reserved: 0,
    committed: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('TicketInventory', () => {
  describe('available getter', () => {
    it('returns capacity when nothing is reserved or committed', () => {
      const inventory = makeInventory({ capacity: 100, reserved: 0, committed: 0 });
      expect(inventory.available).toBe(100);
    });

    it('subtracts reserved from capacity', () => {
      const inventory = makeInventory({ capacity: 100, reserved: 30, committed: 0 });
      expect(inventory.available).toBe(70);
    });

    it('subtracts committed from capacity', () => {
      const inventory = makeInventory({ capacity: 100, reserved: 0, committed: 20 });
      expect(inventory.available).toBe(80);
    });

    it('subtracts both reserved and committed from capacity', () => {
      const inventory = makeInventory({ capacity: 100, reserved: 30, committed: 20 });
      expect(inventory.available).toBe(50);
    });

    it('returns zero when reserved + committed equals capacity', () => {
      const inventory = makeInventory({ capacity: 100, reserved: 60, committed: 40 });
      expect(inventory.available).toBe(0);
    });

    it('reflects correct available for zero capacity', () => {
      const inventory = makeInventory({ capacity: 0, reserved: 0, committed: 0 });
      expect(inventory.available).toBe(0);
    });

    it('does not go negative when calculated from valid DB-enforced state', () => {
      // The CHECK constraint in the DB ensures reserved + committed <= capacity.
      // The entity trusts this invariant; available should not be negative.
      const inventory = makeInventory({ capacity: 10, reserved: 10, committed: 0 });
      expect(inventory.available).toBeGreaterThanOrEqual(0);
    });
  });
});
