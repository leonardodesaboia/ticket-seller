import { ApiProperty } from '@nestjs/swagger';
import type { ListEventsResult } from '../../domain/ports/event-repository.port';
import { EventResponse } from './event.response';

export class ListEventsResponse {
  @ApiProperty({ type: [EventResponse] }) data!: EventResponse[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;

  static from(result: ListEventsResult): ListEventsResponse {
    const res = new ListEventsResponse();
    res.data = result.events.map(EventResponse.from);
    res.nextCursor = result.nextCursor;
    return res;
  }
}
