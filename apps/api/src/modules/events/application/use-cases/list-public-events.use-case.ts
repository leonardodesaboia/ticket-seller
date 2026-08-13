import { Inject, Injectable } from '@nestjs/common';
import {
  PUBLIC_EVENT_QUERY_PORT,
  type IPublicEventQueryPort,
  type PublicEventListResult,
} from '../ports/public-event-query.port';
import { decodePublicCursor } from '../../domain/publication/public-cursor';

export interface ListPublicEventsQuery {
  limit: number;
  cursor?: string;
}

@Injectable()
export class ListPublicEventsUseCase {
  constructor(
    @Inject(PUBLIC_EVENT_QUERY_PORT)
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
