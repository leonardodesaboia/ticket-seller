export interface InitializeInventoryItem {
  ticketTypeId: string;
  eventId: string;
  organizationId: string;
  capacity: number;
}

export interface InventoryInitializationPort {
  initializeForEvent(items: InitializeInventoryItem[]): Promise<void>;
}

export const INVENTORY_INITIALIZATION_PORT = Symbol('INVENTORY_INITIALIZATION_PORT');
