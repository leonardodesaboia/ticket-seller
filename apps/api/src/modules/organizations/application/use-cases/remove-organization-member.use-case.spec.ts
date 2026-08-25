import {
  RemoveOrganizationMemberUseCase,
  MemberNotFoundError,
  LastOwnerProtectionError,
} from './remove-organization-member.use-case';
import type {
  IOrganizationInvitationRepository,
} from '../../domain/ports/organization-invitation-repository.port';

const makeRepo = (): jest.Mocked<IOrganizationInvitationRepository> => ({
  createInvitation: jest.fn(),
  findInvitationByTokenHash: jest.fn(),
  findInvitationById: jest.fn(),
  markInvitationUsed: jest.fn(),
  revokeInvitation: jest.fn(),
  isActiveMember: jest.fn(),
  findActiveMemberByUserId: jest.fn(),
  findMemberById: jest.fn(),
  listActiveMembers: jest.fn(),
  countActiveOwners: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRoleAtomically: jest.fn(),
  removeMemberAtomically: jest.fn(),
  findUserEmailById: jest.fn(),
});

describe('RemoveOrganizationMemberUseCase', () => {
  let useCase: RemoveOrganizationMemberUseCase;
  let repo: jest.Mocked<IOrganizationInvitationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new RemoveOrganizationMemberUseCase(repo);
  });

  it('should remove a member', async () => {
    repo.removeMemberAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1' });

    expect(repo.removeMemberAtomically).toHaveBeenCalledWith('member-1', 'org-1');
  });

  it('should throw MemberNotFoundError when atomic method raises it', async () => {
    repo.removeMemberAtomically.mockRejectedValue(new MemberNotFoundError());

    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'unknown' }),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it('should throw LastOwnerProtectionError when removing the last OWNER', async () => {
    repo.removeMemberAtomically.mockRejectedValue(new LastOwnerProtectionError());

    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'member-1' }),
    ).rejects.toBeInstanceOf(LastOwnerProtectionError);
  });

  it('should allow removing an OWNER when multiple owners exist', async () => {
    repo.removeMemberAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1' });

    expect(repo.removeMemberAtomically).toHaveBeenCalledWith('member-1', 'org-1');
  });

  it('should not call legacy non-atomic methods', async () => {
    repo.removeMemberAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1' });

    expect(repo.findMemberById).not.toHaveBeenCalled();
    expect(repo.countActiveOwners).not.toHaveBeenCalled();
    expect(repo.removeMember).not.toHaveBeenCalled();
  });
});
