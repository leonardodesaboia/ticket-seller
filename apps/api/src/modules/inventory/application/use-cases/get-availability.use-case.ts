import {
  type AvailabilityResult,
  type IInventoryRepository,
} from '../../domain/ports/inventory-repository.port';
import {
  type IPublicEventQueryPort,
} from '../../../events/contracts/public-event-query.contract';

export interface GetAvailabilityQuery {
  eventSlug: string;
}

export interface GetAvailabilityResult {
  eventSlug: string;
  items: AvailabilityResult[];
}

export class GetAvailabilityUseCase {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly publicEventQuery: IPublicEventQueryPort,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<GetAvailabilityResult | null> {
    const event = await this.publicEventQuery.findPublishedBySlug(query.eventSlug);
    if (!event) return null;

    const ticketTypeIds = event.ticketTypes.map((tt) => tt.id);
    if (ticketTypeIds.length === 0) {
      return { eventSlug: query.eventSlug, items: [] };
    }

    const items = await this.inventoryRepository.getAvailability(ticketTypeIds, event.organizationId);
    return { eventSlug: query.eventSlug, items };
  }
}
