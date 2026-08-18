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

  it('resolves actor from X-Dev-User-Id header', async () => {
    const request = { headers: { 'x-dev-user-id': 'user-123' } };
    await expect(adapter.resolve(request)).resolves.toEqual({ userId: 'user-123' });
  });

  it('trims whitespace from header value', async () => {
    const request = { headers: { 'x-dev-user-id': '  user-456  ' } };
    await expect(adapter.resolve(request)).resolves.toEqual({ userId: 'user-456' });
  });

  it('returns null when header is absent', async () => {
    const request = { headers: {} };
    await expect(adapter.resolve(request)).resolves.toBeNull();
  });

  it('returns null when header is empty', async () => {
    const request = { headers: { 'x-dev-user-id': '   ' } };
    await expect(adapter.resolve(request)).resolves.toBeNull();
  });

  it('returns null in production regardless of header', async () => {
    process.env['NODE_ENV'] = 'production';
    const request = { headers: { 'x-dev-user-id': 'user-123' } };
    await expect(adapter.resolve(request)).resolves.toBeNull();
  });
});
