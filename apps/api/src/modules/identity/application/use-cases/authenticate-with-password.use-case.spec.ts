import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthenticateWithPasswordUseCase } from './authenticate-with-password.use-case';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.port';
import type { ISessionRepository } from '../../domain/ports/session.repository.port';
import type { ITokenIssuer } from '../../domain/ports/token-issuer.port';
import type { IAuthAttemptRepository } from '../../domain/ports/auth-attempt.repository.port';
import type { PrismaService } from '../../../../platform/database/prisma.service';

const TEST_USER = { id: 'user-123', email: 'user@example.com', displayName: 'Test User' };
const TEST_IDENTITY = { userId: TEST_USER.id, user: TEST_USER };

const mockHasher: IPasswordHasher = {
  hash: jest.fn(),
  verify: jest.fn().mockResolvedValue(true),
};

const mockSessionRepository: ISessionRepository = {
  create: jest.fn().mockResolvedValue({ id: 'session-abc' }),
  findActiveByTokenHash: jest.fn(),
  findActiveById: jest.fn(),
  revokeById: jest.fn(),
  revokeAllByUserId: jest.fn(),
};

const mockTokenIssuer: ITokenIssuer = {
  issueAccessToken: jest.fn().mockReturnValue('access-token-jwt'),
  verifyAccessToken: jest.fn(),
};

const mockAuthAttemptRepository: IAuthAttemptRepository = {
  record: jest.fn().mockResolvedValue(undefined),
  countRecentFailures: jest.fn().mockResolvedValue(0),
};

const mockPrisma = {
  identity: { findFirst: jest.fn().mockResolvedValue(TEST_IDENTITY) },
  passwordCredential: { findUnique: jest.fn().mockResolvedValue({ hash: '$argon2id$hashed' }) },
};

function makeUseCase(): AuthenticateWithPasswordUseCase {
  return new AuthenticateWithPasswordUseCase(
    mockPrisma as unknown as PrismaService,
    mockHasher,
    mockSessionRepository,
    mockTokenIssuer,
    mockAuthAttemptRepository,
  );
}

describe('AuthenticateWithPasswordUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAttemptRepository.countRecentFailures = jest.fn().mockResolvedValue(0);
    mockPrisma.identity.findFirst = jest.fn().mockResolvedValue(TEST_IDENTITY);
    mockPrisma.passwordCredential.findUnique = jest
      .fn()
      .mockResolvedValue({ hash: '$argon2id$hashed' });
    (mockHasher.verify as jest.Mock).mockResolvedValue(true);
    (mockSessionRepository.create as jest.Mock).mockResolvedValue({ id: 'session-abc' });
    (mockTokenIssuer.issueAccessToken as jest.Mock).mockReturnValue('access-token-jwt');
    (mockAuthAttemptRepository.record as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns access token and user on successful authentication', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({
      email: 'user@example.com',
      password: 'correct-password',
      ip: '127.0.0.1',
    });

    expect(result.accessToken).toBe('access-token-jwt');
    expect(result.user.id).toBe(TEST_USER.id);
    expect(result.user.email).toBe(TEST_USER.email);
    expect(result.refreshToken).toBeDefined();
    expect(typeof result.refreshToken).toBe('string');
  });

  it('records SUCCESS attempt on valid credentials', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ email: 'user@example.com', password: 'correct', ip: '127.0.0.1' });

    expect(mockAuthAttemptRepository.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'SUCCESS', email: 'user@example.com' }),
    );
  });

  it('throws UnauthorizedException and records FAILURE when identity not found', async () => {
    mockPrisma.identity.findFirst = jest.fn().mockResolvedValue(null);
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: 'wrong', ip: '127.0.0.1' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockAuthAttemptRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'FAILURE' }),
    );
  });

  it('throws UnauthorizedException with generic message when password is wrong', async () => {
    (mockHasher.verify as jest.Mock).mockResolvedValue(false);
    const useCase = makeUseCase();

    const err = await useCase
      .execute({ email: 'user@example.com', password: 'wrong', ip: '127.0.0.1' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.message).toBe('Invalid credentials');
  });

  it('throws 429 when too many recent failures', async () => {
    (mockAuthAttemptRepository.countRecentFailures as jest.Mock).mockResolvedValue(5);
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'user@example.com', password: 'any', ip: '127.0.0.1' }),
    ).rejects.toThrow(HttpException);
  });

  it('normalizes email before lookup', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ email: 'User@EXAMPLE.COM', password: 'correct', ip: '1.2.3.4' });

    expect(mockPrisma.identity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerUserId: 'user@example.com' }),
      }),
    );
  });
});
