import { ServiceUnavailableError, UnauthorizedError } from '../../../../shared/kernel/application-errors';
import { RefreshSessionUseCase } from './refresh-session.use-case';
import type { ISessionRepository } from '../../domain/ports/session.repository.port';
import type { ITokenIssuer } from '../../domain/ports/token-issuer.port';
import type { ILogger } from '../../../../shared/kernel/logger.port';

const mockSessionRepository: ISessionRepository = {
  create: jest.fn().mockResolvedValue({ id: 'session-new' }),
  findActiveByTokenHash: jest.fn(),
  findActiveById: jest.fn(),
  revokeById: jest.fn(),
  revokeAllByUserId: jest.fn(),
  rotateByTokenHash: jest.fn().mockResolvedValue({ userId: 'user-123' }),
};

const mockTokenIssuer: ITokenIssuer = {
  issueAccessToken: jest.fn().mockReturnValue('new-access-token'),
  verifyAccessToken: jest.fn(),
};

const mockLogger: ILogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

function makeUseCase(): RefreshSessionUseCase {
  return new RefreshSessionUseCase(mockSessionRepository, mockTokenIssuer, mockLogger);
}

describe('RefreshSessionUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSessionRepository.rotateByTokenHash as jest.Mock).mockResolvedValue({ userId: 'user-123' });
    (mockSessionRepository.create as jest.Mock).mockResolvedValue({ id: 'session-new' });
    (mockTokenIssuer.issueAccessToken as jest.Mock).mockReturnValue('new-access-token');
  });

  it('atomically rotates the token and creates a new session', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({ refreshToken: 'raw-token-value' });

    expect(mockSessionRepository.rotateByTokenHash).toHaveBeenCalledTimes(1);
    expect(mockSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123' }),
    );
    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe('raw-token-value');
  });

  it('throws UnauthorizedException when rotateByTokenHash returns null (invalid/expired/revoked)', async () => {
    (mockSessionRepository.rotateByTokenHash as jest.Mock).mockResolvedValue(null);
    const useCase = makeUseCase();

    await expect(useCase.execute({ refreshToken: 'invalid-token' })).rejects.toThrow(
      UnauthorizedError,
    );
    expect(mockSessionRepository.create).not.toHaveBeenCalled();
  });

  it('issues access token with new session id as jti', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ refreshToken: 'valid-token' });

    expect(mockTokenIssuer.issueAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-123', jti: 'session-new' }),
    );
  });

  it('throws ServiceUnavailableException when session creation fails after rotation', async () => {
    (mockSessionRepository.create as jest.Mock).mockRejectedValue(new Error('DB error'));
    const useCase = makeUseCase();

    await expect(useCase.execute({ refreshToken: 'valid-token' })).rejects.toThrow(
      ServiceUnavailableError,
    );
  });
});
