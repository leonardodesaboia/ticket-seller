import {
  type IPublicEventQueryPort,
  type PublicEventListResult,
} from '../ports/public-event-query.port';
import { decodePublicCursor } from '../../domain/publication/public-cursor';

export interface ListPublicEventsQuery {
  limit: number;
  cursor?: string;
}

export class ListPublicEventsUseCase {
  constructor(
    private readonly queryPort: IPublicEventQueryPort,
  ) {}

  async execute(query: ListPublicEventsQuery): Promise<PublicEventListResult> {
    const cursor = query.cursor !== undefined ? decodePublicCursor(query.cursor) : undefined;
    return this.queryPort.listPublished({
      limit: query.limit,
      ...(cursor && { cursor }),
    });
  }
}
