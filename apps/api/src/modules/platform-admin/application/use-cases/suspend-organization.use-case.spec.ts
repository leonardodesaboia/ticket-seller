import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SuspendOrganizationUseCase } from './suspend-organization.use-case';
import {
  ADMIN_ORGANIZATION_REPOSITORY,
  IAdminOrganizationRepository,
} from '../../domain/ports/admin-organization-repository.port';

describe('SuspendOrganizationUseCase', () => {
  let useCase: SuspendOrganizationUseCase;
  let orgRepo: jest.Mocked<IAdminOrganizationRepository>;

  const mockOrg = { id: 'org-1', suspendedAt: null };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuspendOrganizationUseCase,
        {
          provide: ADMIN_ORGANIZATION_REPOSITORY,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
            suspend: jest.fn(),
            unsuspend: jest.fn(),
            revokeMemberSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(SuspendOrganizationUseCase);
    orgRepo = module.get(ADMIN_ORGANIZATION_REPOSITORY) as jest.Mocked<IAdminOrganizationRepository>;
  });

  it('should suspend an active organization and revoke member sessions', async () => {
    orgRepo.findById.mockResolvedValue(mockOrg);
    orgRepo.suspend.mockResolvedValue(undefined);
    orgRepo.revokeMemberSessions.mockResolvedValue(undefined);

    await useCase.execute({
      actorId: 'admin-1',
      organizationId: 'org-1',
      reason: 'Policy violation',
    });

    expect(orgRepo.suspend).toHaveBeenCalledWith('org-1');
    expect(orgRepo.revokeMemberSessions).toHaveBeenCalledWith('org-1');
  });

  it('should be idempotent when organization is already suspended', async () => {
    orgRepo.findById.mockResolvedValue({ ...mockOrg, suspendedAt: new Date() });

    await useCase.execute({
      actorId: 'admin-1',
      organizationId: 'org-1',
      reason: 'Policy violation',
    });

    expect(orgRepo.suspend).not.toHaveBeenCalled();
    expect(orgRepo.revokeMemberSessions).not.toHaveBeenCalled();
  });

  it('should throw 404 when organization is not found', async () => {
    orgRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ actorId: 'admin-1', organizationId: 'missing-org', reason: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });
});
