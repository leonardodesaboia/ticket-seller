import { Injectable } from '@nestjs/common';
import type { IInventoryHoldPort } from '../../application/ports/inventory-hold.port';

@Injectable()
export class InventoryHoldAdapter implements IInventoryHoldPort {
  readonly moduleName = 'inventory' as const;
}
