import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_INITIALIZATION_PORT,
  type InitializeInventoryItem,
  type InventoryInitializationPort,
} from '../ports/inventory-initialization.port';

@Injectable()
export class InitializeEventInventoryUseCase {
  constructor(
    @Inject(INVENTORY_INITIALIZATION_PORT)
    private readonly inventoryInitialization: InventoryInitializationPort,
  ) {}

  async execute(items: InitializeInventoryItem[]): Promise<void> {
    await this.inventoryInitialization.initializeForEvent(items);
  }
}
