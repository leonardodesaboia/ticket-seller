import { UnauthorizedError, RateLimitError } from '../../../../shared/kernel/application-errors';
import { AuthenticateWithPasswordUseCase } from './authenticate-with-password.use-case';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.port';
import type { ISessionRepository } from '../../domain/ports/session.repository.port';
import type { ITokenIssuer } from '../../domain/ports/token-issuer.port';
import type { IAuthAttemptRepository } from '../../domain/ports/auth-attempt.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

const TEST_USER = { id: 'user-123', email: 'user@example.com', displayName: 'Test User' };
const TEST_IDENTITY_WITH_CREDENTIAL = {
  userId: TEST_USER.id,
  user: TEST_USER,
  credentialHash: '$argon2id$hashed',
  forceReset: false,
};

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
  rotateByTokenHash: jest.fn(),
};

const mockTokenIssuer: ITokenIssuer = {
  issueAccessToken: jest.fn().mockReturnValue('access-token-jwt'),
  verifyAccessToken: jest.fn(),
};

const mockAuthAttemptRepository: IAuthAttemptRepository = {
  record: jest.fn().mockResolvedValue(undefined),
  countRecentFailures: jest.fn().mockResolvedValue(0),
};

const mockUserRepository: IUserRepository = {
  emailExists: jest.fn(),
  findUserIdByEmail: jest.fn(),
  findIdentityWithCredential: jest.fn().mockResolvedValue(TEST_IDENTITY_WITH_CREDENTIAL),
  findProfile: jest.fn(),
  register: jest.fn(),
};

function makeUseCase(): AuthenticateWithPasswordUseCase {
  return new AuthenticateWithPasswordUseCase(
    mockUserRepository,
    mockHasher,
    mockSessionRepository,
    mockTokenIssuer,
    mockAuthAttemptRepository,
  );
}

describe('AuthenticateWithPasswordUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockAuthAttemptRepository.countRecentFailures as jest.Mock).mockResolvedValue(0);
    (mockUserRepository.findIdentityWithCredential as jest.Mock).mockResolvedValue(TEST_IDENTITY_WITH_CREDENTIAL);
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
    expect(result.mustResetPassword).toBe(false);
  });

  it('returns mustResetPassword=true when credential has forceReset flag', async () => {
    (mockUserRepository.findIdentityWithCredential as jest.Mock).mockResolvedValue({
      ...TEST_IDENTITY_WITH_CREDENTIAL,
      forceReset: true,
    });
    const useCase = makeUseCase();

    const result = await useCase.execute({ email: 'user@example.com', password: 'correct', ip: '127.0.0.1' });

    expect(result.mustResetPassword).toBe(true);
    // Session is still created — user needs the token to call the reset endpoint
    expect(result.accessToken).toBe('access-token-jwt');
  });

  it('records SUCCESS attempt on valid credentials', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ email: 'user@example.com', password: 'correct', ip: '127.0.0.1' });

    expect(mockAuthAttemptRepository.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'SUCCESS', email: 'user@example.com' }),
    );
  });

  it('throws UnauthorizedException and records FAILURE when identity not found', async () => {
    (mockUserRepository.findIdentityWithCredential as jest.Mock).mockResolvedValue(null);
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: 'wrong', ip: '127.0.0.1' }),
    ).rejects.toThrow(UnauthorizedError);

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

    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.message).toBe('Invalid credentials');
  });

  it('throws 429 when too many recent failures', async () => {
    (mockAuthAttemptRepository.countRecentFailures as jest.Mock).mockResolvedValue(5);
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'user@example.com', password: 'any', ip: '127.0.0.1' }),
    ).rejects.toThrow(RateLimitError);
  });

  it('normalizes email before lookup', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ email: 'User@EXAMPLE.COM', password: 'correct', ip: '1.2.3.4' });

    expect(mockUserRepository.findIdentityWithCredential).toHaveBeenCalledWith('user@example.com');
  });
});
