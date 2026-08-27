import { NotFoundError, UnprocessableError } from '../../../../shared/kernel/application-errors';
import { IAdminUserRepository } from '../../domain/ports/admin-user-repository.port';
import { PlatformRole } from '../../../../shared/kernel/platform-role';
import { SuspendUserUseCase } from './suspend-user.use-case';

const makeLogger = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() });

describe('SuspendUserUseCase', () => {
  let useCase: SuspendUserUseCase;
  let userRepo: jest.Mocked<IAdminUserRepository>;

  beforeEach(() => {
    userRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      suspend: jest.fn(),
      unsuspend: jest.fn(),
      revokeAllSessions: jest.fn(),
    } as unknown as jest.Mocked<IAdminUserRepository>;

    useCase = new SuspendUserUseCase(userRepo, makeLogger());
  });

  it('should suspend a regular user and revoke their sessions', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'user-2',
      platformRole: null,
      suspendedAt: null,
    });
    userRepo.suspend.mockResolvedValue(undefined);
    userRepo.revokeAllSessions.mockResolvedValue(undefined);

    await useCase.execute({
      actorId: 'admin-1',
      userId: 'user-2',
      reason: 'Terms violation',
    });

    expect(userRepo.suspend).toHaveBeenCalledWith('user-2');
    expect(userRepo.revokeAllSessions).toHaveBeenCalledWith('user-2');
  });

  it('should throw 422 when trying to suspend self', async () => {
    await expect(
      useCase.execute({
        actorId: 'admin-1',
        userId: 'admin-1',
        reason: 'Self suspension',
      }),
    ).rejects.toThrow(UnprocessableError);

    expect(userRepo.suspend).not.toHaveBeenCalled();
  });

  it('should throw 404 when user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'ghost-user', reason: 'Test' }),
    ).rejects.toThrow(NotFoundError);

    expect(userRepo.suspend).not.toHaveBeenCalled();
  });

  it('should throw 422 when trying to suspend a PLATFORM_ADMIN', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'admin-2',
      platformRole: PlatformRole.PLATFORM_ADMIN,
      suspendedAt: null,
    });

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'admin-2', reason: 'Test' }),
    ).rejects.toThrow(UnprocessableError);

    expect(userRepo.suspend).not.toHaveBeenCalled();
  });

  it('should throw 422 when trying to suspend a PLATFORM_SUPPORT', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'support-1',
      platformRole: PlatformRole.PLATFORM_SUPPORT,
      suspendedAt: null,
    });

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'support-1', reason: 'Test' }),
    ).rejects.toThrow(UnprocessableError);

    expect(userRepo.suspend).not.toHaveBeenCalled();
  });

  it('should be idempotent when user is already suspended', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'user-2',
      platformRole: null,
      suspendedAt: new Date(),
    });

    await useCase.execute({
      actorId: 'admin-1',
      userId: 'user-2',
      reason: 'Re-suspend',
    });

    expect(userRepo.suspend).not.toHaveBeenCalled();
    expect(userRepo.revokeAllSessions).not.toHaveBeenCalled();
  });
});
