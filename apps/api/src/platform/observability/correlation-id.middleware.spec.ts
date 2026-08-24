import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { requestContextStorage } from './request-context';

function makeReq(requestId?: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.headers = requestId ? { 'x-request-id': requestId } : {};
  return req;
}

function makeRes(): ServerResponse & { _headers: Record<string, string> } {
  const res = new EventEmitter() as unknown as ServerResponse & {
    _headers: Record<string, string>;
  };
  res._headers = {};
  res.setHeader = (name: string, value: string) => {
    res._headers[name.toLowerCase()] = value;
    return res;
  };
  return res;
}

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('generates a UUID when no X-Request-Id header is provided', (done) => {
    const req = makeReq();
    const res = makeRes();

    middleware.use(req, res, () => {
      const requestId = res._headers['x-request-id'];
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(requestContextStorage.getStore()?.requestId).toBe(requestId);
      done();
    });
  });

  it('reuses a valid UUID from X-Request-Id header', (done) => {
    const incoming = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
    const req = makeReq(incoming);
    const res = makeRes();

    middleware.use(req, res, () => {
      expect(res._headers['x-request-id']).toBe(incoming);
      expect(requestContextStorage.getStore()?.requestId).toBe(incoming);
      done();
    });
  });

  it('generates a new UUID when the header value is not a valid UUID v4', (done) => {
    const req = makeReq('not-a-uuid');
    const res = makeRes();

    middleware.use(req, res, () => {
      const requestId = res._headers['x-request-id'];
      expect(requestId).not.toBe('not-a-uuid');
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      done();
    });
  });
});
