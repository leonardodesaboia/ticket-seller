import { DevelopmentActorAdapter } from './development-actor.adapter';

describe('DevelopmentActorAdapter', () => {
  let adapter: DevelopmentActorAdapter;
  const originalEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    adapter = new DevelopmentActorAdapter();
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  it('resolves actor from X-Dev-User-Id header', () => {
    const request = { headers: { 'x-dev-user-id': 'user-123' } };
    expect(adapter.resolve(request)).toEqual({ userId: 'user-123' });
  });

  it('trims whitespace from header value', () => {
    const request = { headers: { 'x-dev-user-id': '  user-456  ' } };
    expect(adapter.resolve(request)).toEqual({ userId: 'user-456' });
  });

  it('returns null when header is absent', () => {
    const request = { headers: {} };
    expect(adapter.resolve(request)).toBeNull();
  });

  it('returns null when header is empty', () => {
    const request = { headers: { 'x-dev-user-id': '   ' } };
    expect(adapter.resolve(request)).toBeNull();
  });

  it('returns null in production regardless of header', () => {
    process.env['NODE_ENV'] = 'production';
    const request = { headers: { 'x-dev-user-id': 'user-123' } };
    expect(adapter.resolve(request)).toBeNull();
  });
});
