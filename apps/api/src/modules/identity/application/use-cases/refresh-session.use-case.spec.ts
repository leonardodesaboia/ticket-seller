import { UnauthorizedException } from '@nestjs/common';
import { RefreshSessionUseCase } from './refresh-session.use-case';
import type { ISessionRepository, ActiveSession } from '../../domain/ports/session.repository.port';
import type { ITokenIssuer } from '../../domain/ports/token-issuer.port';

const ACTIVE_SESSION: ActiveSession = {
  id: 'session-old',
  userId: 'user-123',
  tokenHash: 'hashed-old-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  revokedAt: null,
};

const mockSessionRepository: ISessionRepository = {
  create: jest.fn().mockResolvedValue({ id: 'session-new' }),
  findActiveByTokenHash: jest.fn(),
  findActiveById: jest.fn(),
  revokeById: jest.fn().mockResolvedValue(undefined),
  revokeAllByUserId: jest.fn(),
};

const mockTokenIssuer: ITokenIssuer = {
  issueAccessToken: jest.fn().mockReturnValue('new-access-token'),
  verifyAccessToken: jest.fn(),
};

function makeUseCase(): RefreshSessionUseCase {
  return new RefreshSessionUseCase(mockSessionRepository, mockTokenIssuer);
}

describe('RefreshSessionUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSessionRepository.findActiveByTokenHash as jest.Mock).mockResolvedValue(ACTIVE_SESSION);
    (mockSessionRepository.create as jest.Mock).mockResolvedValue({ id: 'session-new' });
    (mockSessionRepository.revokeById as jest.Mock).mockResolvedValue(undefined);
    (mockTokenIssuer.issueAccessToken as jest.Mock).mockReturnValue('new-access-token');
  });

  it('revokes old session and creates new one (token rotation)', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({ refreshToken: 'raw-token-value' });

    expect(mockSessionRepository.revokeById).toHaveBeenCalledWith('session-old');
    expect(mockSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123' }),
    );
    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe('raw-token-value'); // new token
  });

  it('throws UnauthorizedException when session not found', async () => {
    (mockSessionRepository.findActiveByTokenHash as jest.Mock).mockResolvedValue(null);
    const useCase = makeUseCase();

    await expect(useCase.execute({ refreshToken: 'invalid-token' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockSessionRepository.revokeById).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when session is revoked', async () => {
    (mockSessionRepository.findActiveByTokenHash as jest.Mock).mockResolvedValue({
      ...ACTIVE_SESSION,
      revokedAt: new Date(),
    });
    const useCase = makeUseCase();

    await expect(useCase.execute({ refreshToken: 'revoked-token' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when session is expired', async () => {
    (mockSessionRepository.findActiveByTokenHash as jest.Mock).mockResolvedValue({
      ...ACTIVE_SESSION,
      expiresAt: new Date(Date.now() - 1000),
    });
    const useCase = makeUseCase();

    await expect(useCase.execute({ refreshToken: 'expired-token' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('issues access token with new session id as jti', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ refreshToken: 'valid-token' });

    expect(mockTokenIssuer.issueAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-123', jti: 'session-new' }),
    );
  });
});
