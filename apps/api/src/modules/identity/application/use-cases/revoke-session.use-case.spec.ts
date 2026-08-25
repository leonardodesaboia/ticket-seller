import { RevokeSessionUseCase } from './revoke-session.use-case';
import type { ISessionRepository } from '../../domain/ports/session.repository.port';

const mockSessionRepository: ISessionRepository = {
  create: jest.fn(),
  findActiveByTokenHash: jest.fn(),
  findActiveById: jest.fn(),
  revokeById: jest.fn().mockResolvedValue(undefined),
  revokeAllByUserId: jest.fn(),
  rotateByTokenHash: jest.fn(),
};

describe('RevokeSessionUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSessionRepository.revokeById as jest.Mock).mockResolvedValue(undefined);
  });

  it('revokes session by id', async () => {
    const useCase = new RevokeSessionUseCase(mockSessionRepository);
    await useCase.execute({ sessionId: 'session-abc' });

    expect(mockSessionRepository.revokeById).toHaveBeenCalledWith('session-abc');
  });

  it('is idempotent — calling twice does not throw', async () => {
    const useCase = new RevokeSessionUseCase(mockSessionRepository);
    await useCase.execute({ sessionId: 'session-abc' });
    await useCase.execute({ sessionId: 'session-abc' });

    expect(mockSessionRepository.revokeById).toHaveBeenCalledTimes(2);
  });
});
