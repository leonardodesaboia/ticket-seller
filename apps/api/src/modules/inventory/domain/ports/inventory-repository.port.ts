import type { TicketInventory } from '../ticket-inventory.entity';
import type { InsufficientInventoryError } from '../inventory.errors';

export interface InitializeInventoryItem {
  ticketTypeId: string;
  eventId: string;
  organizationId: string;
  capacity: number;
}

export interface AvailabilityResult {
  ticketTypeId: string;
  availableQuantity: number;
}

export interface IInventoryRepository {
  findByTicketTypeId(organizationId: string, ticketTypeId: string): Promise<TicketInventory | null>;
  findByEventId(organizationId: string, eventId: string): Promise<TicketInventory[]>;
  /**
   * Initializes inventory for all ticket types of an event.
   * Must execute inside a transaction.
   */
  initializeForEvent(items: InitializeInventoryItem[]): Promise<void>;
  /**
   * Attempts to reserve the given quantity for a ticket type using an atomic
   * UPDATE ... WHERE ... RETURNING pattern to avoid race conditions.
   * Throws {@link InsufficientInventoryError} when there is not enough availability.
   */
  tryReserve(
    organizationId: string,
    ticketTypeId: string,
    quantity: number,
  ): Promise<TicketInventory>;
  releaseHold(organizationId: string, ticketTypeId: string, quantity: number): Promise<void>;
  getAvailability(ticketTypeIds: string[]): Promise<AvailabilityResult[]>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

// Re-export the error type for convenience
export type { InsufficientInventoryError };
