import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestContextStorage } from './request-context';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const headerValue = req.headers['x-request-id'];
    const incoming = typeof headerValue === 'string' ? headerValue : undefined;
    const requestId = incoming && UUID_V4.test(incoming) ? incoming : randomUUID();

    requestContextStorage.run({ requestId }, () => {
      res.setHeader('X-Request-Id', requestId);
      next();
    });
  }
}
