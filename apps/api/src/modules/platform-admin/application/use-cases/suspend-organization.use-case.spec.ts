import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { IAdminOrganizationRepository } from '../../domain/ports/admin-organization-repository.port';
import { SuspendOrganizationUseCase } from './suspend-organization.use-case';

const makeLogger = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() });

describe('SuspendOrganizationUseCase', () => {
  let useCase: SuspendOrganizationUseCase;
  let orgRepo: jest.Mocked<IAdminOrganizationRepository>;

  const mockOrg = { id: 'org-1', suspendedAt: null };

  beforeEach(() => {
    orgRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      suspend: jest.fn(),
      unsuspend: jest.fn(),
      revokeMemberSessions: jest.fn(),
    } as unknown as jest.Mocked<IAdminOrganizationRepository>;

    useCase = new SuspendOrganizationUseCase(orgRepo, makeLogger());
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
    ).rejects.toThrow(NotFoundError);
  });
});
