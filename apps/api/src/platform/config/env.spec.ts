describe('environment configuration', () => {
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnvironment = { ...process.env };
    jest.resetModules();
    process.env = {
      ...originalEnvironment,
      DATABASE_URL: 'postgresql://ticket_seller:ticket_seller@localhost:5432/ticket_seller',
      CORS_ORIGINS: 'http://localhost:3001',
      JWT_SECRET: 'a-secure-test-secret-with-at-least-32-characters',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
    jest.resetModules();
  });

  it('defaults PAYMENT_PROVIDER to fake outside production', async () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['PAYMENT_PROVIDER'];
    delete process.env['FAKE_GATEWAY_SECRET'];

    const { env } = await import('./env');

    expect(env.PAYMENT_PROVIDER).toBe('fake');
  });

  it('fails early in production when the fake provider secret is absent', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PAYMENT_PROVIDER'] = 'fake';
    delete process.env['FAKE_GATEWAY_SECRET'];

    await expect(import('./env')).rejects.toThrow(
      'FAKE_GATEWAY_SECRET is required in production when PAYMENT_PROVIDER is fake',
    );
  });

  it('fails early in production when FAKE_PAYOUT_SECRET is absent', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PAYMENT_PROVIDER'] = 'fake';
    process.env['FAKE_GATEWAY_SECRET'] = 'production-fake-gateway-secret';
    delete process.env['FAKE_PAYOUT_SECRET'];

    await expect(import('./env')).rejects.toThrow(
      'FAKE_PAYOUT_SECRET is required in production',
    );
  });

  it('accepts the fake provider in production with all secrets configured', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PAYMENT_PROVIDER'] = 'fake';
    process.env['FAKE_GATEWAY_SECRET'] = 'production-fake-gateway-secret';
    process.env['FAKE_PAYOUT_SECRET'] = 'production-fake-payout-secret';

    const { env } = await import('./env');

    expect(env.PAYMENT_PROVIDER).toBe('fake');
    expect(env.FAKE_GATEWAY_SECRET).toBe('production-fake-gateway-secret');
    expect(env.FAKE_PAYOUT_SECRET).toBe('production-fake-payout-secret');
  });
});
