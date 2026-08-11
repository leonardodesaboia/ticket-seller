export class InsufficientInventoryError extends Error {
  constructor(public readonly ticketTypeId: string) {
    super(`Insufficient inventory for ticket type ${ticketTypeId}`);
    this.name = 'InsufficientInventoryError';
  }
}

export class InventoryNotFoundError extends Error {
  constructor(public readonly ticketTypeId: string) {
    super(`Inventory not found for ticket type ${ticketTypeId}`);
    this.name = 'InventoryNotFoundError';
  }
}
