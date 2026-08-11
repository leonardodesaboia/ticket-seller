export interface IInventoryHoldPort {
  // Public integration seam reserved for future order confirmation. Creation and
  // cancellation are executed atomically by the reservation repository.
  readonly moduleName: 'inventory';
}

export const INVENTORY_HOLD_PORT = Symbol('INVENTORY_HOLD_PORT');
