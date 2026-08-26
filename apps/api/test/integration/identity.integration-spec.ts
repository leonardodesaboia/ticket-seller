import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createHash, randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/platform/http/filters/http-exception.filter';
import { PrismaService } from '../../src/platform/database/prisma.service';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  process.env['DATABASE_URL'] = url;

  const result = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(result.status)}`);
  }

  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  prisma = module.get(PrismaService);
}, 120000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

afterEach(async () => {
  await prisma.authenticationAttempt.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.passwordCredential.deleteMany();
  await prisma.identity.deleteMany();
  await prisma.user.deleteMany();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerUser(email: string, password: string, displayName?: string): Promise<string> {
  const res = await supertest(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password, displayName });
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as { userId: string }).userId;
}

async function loginUser(email: string, password: string): Promise<supertest.Response> {
  return supertest(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
}

function extractRefreshToken(res: supertest.Response): string | null {
  const setCookie = res.headers['set-cookie'] as string | string[] | undefined;
  if (!setCookie) return null;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of cookies) {
    const match = /refresh_token=([^;]+)/.exec(cookie);
    if (match) return match[1] ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with userId for valid email + password', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'user@example.com', password: 'StrongPass1!' })
      .expect(201);

    expect(res.body).toMatchObject({ userId: expect.any(String) });
    expect((res.body as { userId: string }).userId).toBeTruthy();
  });

  it('returns 201 with optional displayName', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'named@example.com', password: 'StrongPass1!', displayName: 'Alice' })
      .expect(201);

    const user = await prisma.user.findUnique({
      where: { id: (res.body as { userId: string }).userId },
      select: { displayName: true },
    });
    expect(user?.displayName).toBe('Alice');
  });

  it('persists user, local identity, and password credential in the database', async () => {
    const email = 'persist@example.com';
    const userId = await registerUser(email, 'StrongPass1!');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(email);

    const identity = await prisma.identity.findFirst({ where: { userId, provider: 'local' } });
    expect(identity).not.toBeNull();
    expect(identity?.emailVerified).toBe(false);

    const credential = await prisma.passwordCredential.findUnique({ where: { userId } });
    expect(credential).not.toBeNull();
  });

  it('creates an email verification token for the new user', async () => {
    const userId = await registerUser('verify-token@example.com', 'StrongPass1!');

    const token = await prisma.emailVerificationToken.findFirst({ where: { userId } });
    expect(token).not.toBeNull();
    expect(token?.usedAt).toBeNull();
    expect(token?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 409 when email is already registered', async () => {
    await registerUser('dup@example.com', 'StrongPass1!');

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'dup@example.com', password: 'AnotherPass1!' })
      .expect(409);
  });

  it('returns 409 for email differing only in case (email normalisation)', async () => {
    await registerUser('case@example.com', 'StrongPass1!');

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'CASE@EXAMPLE.COM', password: 'AnotherPass1!' })
      .expect(409);
  });

  it('returns 400 when email is invalid', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'StrongPass1!' })
      .expect(400);
  });

  it('returns 400 when password is shorter than 8 characters', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'short@example.com', password: 'abc' })
      .expect(400);
  });

  it('returns 400 when email is missing', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ password: 'StrongPass1!' })
      .expect(400);
  });

  it('returns 400 when password is missing', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'user@example.com' })
      .expect(400);
  });

  it('returns 400 when body is empty', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({})
      .expect(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
  const email = 'login@example.com';
  const password = 'StrongPass1!';

  beforeEach(async () => {
    await registerUser(email, password);
  });

  it('returns 200 with accessToken and user payload', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      user: { id: expect.any(String), email, displayName: null },
    });
    expect((res.body as { accessToken: string }).accessToken).toBeTruthy();
  });

  it('sets an HttpOnly refresh_token cookie on successful login', async () => {
    const res = await loginUser(email, password);
    expect(res.status).toBe(200);

    const setCookie = res.headers['set-cookie'] as string | string[] | undefined;
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie!];
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(refreshCookie).toMatch(/SameSite=Strict/);
  });

  it('creates a session in the database on successful login', async () => {
    const res = await loginUser(email, password);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email } });
    const session = await prisma.session.findFirst({
      where: { userId: user!.id, revokedAt: null },
    });
    expect(session).not.toBeNull();
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('records a SUCCESS attempt in database on successful login', async () => {
    await loginUser(email, password);

    const attempt = await prisma.authenticationAttempt.findFirst({
      where: { email, outcome: 'SUCCESS' },
    });
    expect(attempt).not.toBeNull();
  });

  it('returns 401 for wrong password', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(401);
  });

  it('returns 401 for non-existent email', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password })
      .expect(401);
  });

  it('records a FAILURE attempt in database on bad credentials', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword!' });

    const attempt = await prisma.authenticationAttempt.findFirst({
      where: { email, outcome: 'FAILURE' },
    });
    expect(attempt).not.toBeNull();
  });

  it('returns 429 after 5 DB-recorded failures within the 15-minute window', async () => {
    // SmartThrottlerGuard is bypassed in test env (returns true immediately).
    // The use-case enforces its own DB-based lock: MAX_FAILURES=5, WINDOW=15min.
    const attemptedAt = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.authenticationAttempt.createMany({
      data: Array.from({ length: 5 }, () => ({
        email,
        ip: '127.0.0.1',
        outcome: 'FAILURE',
        attemptedAt,
      })),
    });

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(429);
  });

  it('returns 400 when email is invalid', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bad-email', password })
      .expect(400);
  });

  it('returns 400 when password is missing', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email })
      .expect(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/refresh', () => {
  const email = 'refresh@example.com';
  const password = 'StrongPass1!';
  let refreshToken: string;

  beforeEach(async () => {
    await registerUser(email, password);
    const res = await loginUser(email, password);
    const token = extractRefreshToken(res);
    if (!token) throw new Error('Could not extract refresh token from login response');
    refreshToken = token;
  });

  it('returns 200 with a new accessToken when a valid refresh_token cookie is provided', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ accessToken: expect.any(String) });
    expect((res.body as { accessToken: string }).accessToken).toBeTruthy();
  });

  it('rotates the refresh token — issues a new Set-Cookie on refresh', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(200);

    const newToken = extractRefreshToken(res);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(refreshToken);
  });

  it('revokes the old session after token rotation', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(200);

    const oldSession = await prisma.session.findFirst({ where: { userId: user!.id, tokenHash } });
    expect(oldSession?.revokedAt).not.toBeNull();
  });

  it('returns 401 when no cookie is provided', async () => {
    await supertest(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('returns 401 for an invalid (garbage) refresh token value', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=totally-invalid-token-value')
      .expect(401);
  });

  it('returns 401 when the same refresh token is reused (replay attack prevention)', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(200);

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(401);
  });

  it('returns 401 for a well-formed token whose session has been expired in the DB', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.session.updateMany({
      where: { userId: user!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
  const email = 'logout@example.com';
  const password = 'StrongPass1!';
  let userId: string;

  beforeEach(async () => {
    userId = await registerUser(email, password);
  });

  it('returns 200 and clears the refresh_token cookie when authenticated', async () => {
    await loginUser(email, password);

    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('X-Dev-User-Id', userId)
      .expect(200);

    const setCookie = res.headers['set-cookie'] as string | string[] | undefined;
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie!];
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/Max-Age=0/);
  });

  it('returns 200 even if no active session exists (idempotent logout)', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('X-Dev-User-Id', userId)
      .expect(200);
  });

  it('returns 401 when no authentication is provided', async () => {
    await supertest(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/me', () => {
  const email = 'me@example.com';
  const password = 'StrongPass1!';
  let userId: string;

  beforeEach(async () => {
    userId = await registerUser(email, password);
  });

  it('returns 200 with user profile when authenticated via X-Dev-User-Id', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('X-Dev-User-Id', userId)
      .expect(200);

    expect(res.body).toMatchObject({
      id: userId,
      email,
      emailVerified: false,
      displayName: null,
      locale: expect.any(String),
      timezone: expect.any(String),
    });
  });

  it('reflects emailVerified=true after identity is marked verified', async () => {
    await prisma.identity.updateMany({
      where: { userId, provider: 'local' },
      data: { emailVerified: true },
    });

    const res = await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('X-Dev-User-Id', userId)
      .expect(200);

    expect((res.body as { emailVerified: boolean }).emailVerified).toBe(true);
  });

  it('returns the correct displayName when set during registration', async () => {
    const namedUserId = await registerUser('named-me@example.com', 'StrongPass1!', 'Bob');

    const res = await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('X-Dev-User-Id', namedUserId)
      .expect(200);

    expect((res.body as { displayName: string }).displayName).toBe('Bob');
  });

  it('returns 401 when no authentication is provided', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('returns 403 when the authenticated user account is suspended', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date() },
    });

    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('X-Dev-User-Id', userId)
      .expect(403);
  });
});

// ---------------------------------------------------------------------------
// Full flow: register → login → refresh → me
// ---------------------------------------------------------------------------

describe('Identity full flow: register → login → refresh → me', () => {
  it('produces consistent userId across all steps', async () => {
    const email = `flow-${randomUUID()}@example.com`;
    const password = 'FlowPass1!';

    const registerRes = await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const registeredUserId = (registerRes.body as { userId: string }).userId;

    const loginRes = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const { accessToken, user } = loginRes.body as {
      accessToken: string;
      user: { id: string; email: string };
    };
    expect(user.id).toBe(registeredUserId);
    expect(user.email).toBe(email);

    const refreshToken = extractRefreshToken(loginRes);
    expect(refreshToken).not.toBeNull();

    const refreshRes = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken!}`)
      .expect(200);
    const newAccessToken = (refreshRes.body as { accessToken: string }).accessToken;
    expect(newAccessToken).toBeTruthy();
    expect(newAccessToken).not.toBe(accessToken);

    const meRes = await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('X-Dev-User-Id', registeredUserId)
      .expect(200);
    expect((meRes.body as { id: string }).id).toBe(registeredUserId);
    expect((meRes.body as { email: string }).email).toBe(email);
  });
});
