import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SuspendUserUseCase } from './suspend-user.use-case';
import {
  ADMIN_USER_REPOSITORY,
  IAdminUserRepository,
} from '../../domain/ports/admin-user-repository.port';
import { PlatformRole } from '../../../../shared/kernel/platform-role';

describe('SuspendUserUseCase', () => {
  let useCase: SuspendUserUseCase;
  let userRepo: jest.Mocked<IAdminUserRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuspendUserUseCase,
        {
          provide: ADMIN_USER_REPOSITORY,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
            suspend: jest.fn(),
            unsuspend: jest.fn(),
            revokeAllSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(SuspendUserUseCase);
    userRepo = module.get(ADMIN_USER_REPOSITORY) as jest.Mocked<IAdminUserRepository>;
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
    ).rejects.toThrow(UnprocessableEntityException);

    expect(userRepo.suspend).not.toHaveBeenCalled();
  });

  it('should throw 404 when user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'ghost-user', reason: 'Test' }),
    ).rejects.toThrow(NotFoundException);

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
    ).rejects.toThrow(UnprocessableEntityException);

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
    ).rejects.toThrow(UnprocessableEntityException);

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
