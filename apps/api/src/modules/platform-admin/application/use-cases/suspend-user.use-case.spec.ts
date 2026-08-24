import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SuspendUserUseCase } from './suspend-user.use-case';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PlatformRole } from '../../../../shared/kernel/platform-role';

describe('SuspendUserUseCase', () => {
  let useCase: SuspendUserUseCase;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuspendUserUseCase,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    useCase = module.get(SuspendUserUseCase);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('should suspend a regular user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-2',
      platformRole: null,
      suspendedAt: null,
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    await useCase.execute({
      actorId: 'admin-1',
      userId: 'user-2',
      reason: 'Terms violation',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { suspendedAt: expect.any(Date) },
    });
  });

  it('should throw 422 when trying to suspend self', async () => {
    await expect(
      useCase.execute({
        actorId: 'admin-1',
        userId: 'admin-1',
        reason: 'Self suspension',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should throw 404 when user does not exist', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'ghost-user', reason: 'Test' }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should throw 422 when trying to suspend a PLATFORM_ADMIN', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-2',
      platformRole: PlatformRole.PLATFORM_ADMIN,
      suspendedAt: null,
    });

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'admin-2', reason: 'Test' }),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should throw 422 when trying to suspend a PLATFORM_SUPPORT', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'support-1',
      platformRole: PlatformRole.PLATFORM_SUPPORT,
      suspendedAt: null,
    });

    await expect(
      useCase.execute({ actorId: 'admin-1', userId: 'support-1', reason: 'Test' }),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should be idempotent when user is already suspended', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-2',
      platformRole: null,
      suspendedAt: new Date(),
    });

    await useCase.execute({
      actorId: 'admin-1',
      userId: 'user-2',
      reason: 'Re-suspend',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
