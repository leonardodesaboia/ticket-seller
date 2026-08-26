import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BlockPayoutUseCase } from './block-payout.use-case';
import {
  ADMIN_PAYOUT_REPOSITORY,
  IAdminPayoutRepository,
} from '../../domain/ports/admin-payout-repository.port';

describe('BlockPayoutUseCase', () => {
  let useCase: BlockPayoutUseCase;
  let payoutRepo: jest.Mocked<IAdminPayoutRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BlockPayoutUseCase,
        {
          provide: ADMIN_PAYOUT_REPOSITORY,
          useValue: {
            findById: jest.fn(),
            blockIfBlockable: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(BlockPayoutUseCase);
    payoutRepo = module.get(ADMIN_PAYOUT_REPOSITORY) as jest.Mocked<IAdminPayoutRepository>;
  });

  it('should block a SCHEDULED payout', async () => {
    payoutRepo.findById.mockResolvedValue({ id: 'payout-1', status: 'SCHEDULED' });
    payoutRepo.blockIfBlockable.mockResolvedValue({ count: 1 });

    await useCase.execute({
      actorId: 'admin-1',
      payoutId: 'payout-1',
      reason: 'Suspicious activity',
    });

    expect(payoutRepo.blockIfBlockable).toHaveBeenCalledWith('payout-1', ['SCHEDULED', 'PROCESSING']);
  });

  it('should block a PROCESSING payout', async () => {
    payoutRepo.findById.mockResolvedValue({ id: 'payout-2', status: 'PROCESSING' });
    payoutRepo.blockIfBlockable.mockResolvedValue({ count: 1 });

    await useCase.execute({
      actorId: 'admin-1',
      payoutId: 'payout-2',
      reason: 'Compliance hold',
    });

    expect(payoutRepo.blockIfBlockable).toHaveBeenCalledWith('payout-2', ['SCHEDULED', 'PROCESSING']);
  });

  it('should throw 422 when payout is in SUCCEEDED status', async () => {
    payoutRepo.findById.mockResolvedValue({ id: 'payout-3', status: 'SUCCEEDED' });

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-3',
        reason: 'Too late',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(payoutRepo.blockIfBlockable).not.toHaveBeenCalled();
  });

  it('should throw 422 when status changes concurrently between findById and blockIfBlockable', async () => {
    payoutRepo.findById.mockResolvedValue({ id: 'payout-6', status: 'SCHEDULED' });
    payoutRepo.blockIfBlockable.mockResolvedValue({ count: 0 });

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-6',
        reason: 'Race condition',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should throw 404 when payout is not found', async () => {
    payoutRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-404',
        reason: 'Not found',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw 422 when payout is BLOCKED already', async () => {
    payoutRepo.findById.mockResolvedValue({ id: 'payout-5', status: 'BLOCKED' });

    await expect(
      useCase.execute({
        actorId: 'admin-1',
        payoutId: 'payout-5',
        reason: 'Already blocked',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
