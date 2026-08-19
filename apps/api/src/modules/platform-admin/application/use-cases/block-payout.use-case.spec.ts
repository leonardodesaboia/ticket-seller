import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { BlockPayoutUseCase } from './block-payout.use-case';
import { PrismaService } from '../../../../platform/database/prisma.service';

describe('BlockPayoutUseCase', () => {
  let useCase: BlockPayoutUseCase;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BlockPayoutUseCase,
        {
          provide: PrismaService,
          useValue: {
            payout: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    useCase = module.get(BlockPayoutUseCase);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('should block a SCHEDULED payout', async () => {
    (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-1',
      status: 'SCHEDULED',
    });
    (prisma.payout.update as jest.Mock).mockResolvedValue({});

    await useCase.execute({
      actorId: 'admin-1',
      payoutId: 'payout-1',
      reason: 'Suspicious activity',
    });

    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: { status: 'BLOCKED' },
    });
  });

  it('should block a PROCESSING payout', async () => {
    (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-2',
      status: 'PROCESSING',
    });
    (prisma.payout.update as jest.Mock).mockResolvedValue({});

    await useCase.execute({
      actorId: 'admin-1',
      payoutId: 'payout-2',
      reason: 'Compliance hold',
    });

    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'payout-2' },
      data: { status: 'BLOCKED' },
    });
  });

  it('should throw 422 when payout is in SUCCEEDED status', async () => {
    (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-3',
      status: 'SUCCEEDED',
    });

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-3',
        reason: 'Too late',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(prisma.payout.update).not.toHaveBeenCalled();
  });

  it('should throw 422 when payout is not found', async () => {
    (prisma.payout.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-404',
        reason: 'Not found',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should throw 422 when payout is BLOCKED already', async () => {
    (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-5',
      status: 'BLOCKED',
    });

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-5',
        reason: 'Already blocked',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
