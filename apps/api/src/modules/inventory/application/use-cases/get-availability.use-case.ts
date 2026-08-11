import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  type AvailabilityResult,
  type IInventoryRepository,
} from '../../domain/ports/inventory-repository.port';
import {
  PUBLIC_EVENT_QUERY_PORT,
  type IPublicEventQueryPort,
} from '../../../events/application/ports/public-event-query.port';

export interface GetAvailabilityQuery {
  eventSlug: string;
}

export interface GetAvailabilityResult {
  eventSlug: string;
  items: AvailabilityResult[];
}

@Injectable()
export class GetAvailabilityUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    @Inject(PUBLIC_EVENT_QUERY_PORT)
    private readonly publicEventQuery: IPublicEventQueryPort,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<GetAvailabilityResult | null> {
    const event = await this.publicEventQuery.findPublishedBySlug(query.eventSlug);
    if (!event) return null;

    const ticketTypeIds = event.ticketTypes.map((tt) => tt.id);
    if (ticketTypeIds.length === 0) {
      return { eventSlug: query.eventSlug, items: [] };
    }

    const items = await this.inventoryRepository.getAvailability(ticketTypeIds);
    return { eventSlug: query.eventSlug, items };
  }
}
