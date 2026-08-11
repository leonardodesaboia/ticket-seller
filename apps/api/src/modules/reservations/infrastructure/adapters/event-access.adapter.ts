import { Injectable } from '@nestjs/common';
import type { IEventAccessPort } from '../../application/ports/event-access.port';

@Injectable()
export class EventAccessAdapter implements IEventAccessPort {
  readonly moduleName = 'events' as const;
}
