import { Inject, Injectable } from '@nestjs/common';
import {
  PUBLIC_EVENT_QUERY_PORT,
  type IPublicEventQueryPort,
  type PublicEventDetail,
} from '../ports/public-event-query.port';
import { PublicEventNotFoundError } from '../errors/public-catalog.errors';

@Injectable()
export class GetPublicEventUseCase {
  constructor(
    @Inject(PUBLIC_EVENT_QUERY_PORT)
    private readonly queryPort: IPublicEventQueryPort,
  ) {}

  async execute(slug: string): Promise<PublicEventDetail> {
    const detail = await this.queryPort.findPublishedBySlug(slug);
    if (!detail) throw new PublicEventNotFoundError();
    return detail;
  }
}
