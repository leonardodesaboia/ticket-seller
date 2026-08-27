import {
  type IPublicEventQueryPort,
  type PublicEventDetail,
} from '../ports/public-event-query.port';
import { PublicEventNotFoundError } from '../errors/public-catalog.errors';

export class GetPublicEventUseCase {
  constructor(
    private readonly queryPort: IPublicEventQueryPort,
  ) {}

  async execute(slug: string): Promise<PublicEventDetail> {
    const detail = await this.queryPort.findPublishedBySlug(slug);
    if (!detail) throw new PublicEventNotFoundError();
    return detail;
  }
}
