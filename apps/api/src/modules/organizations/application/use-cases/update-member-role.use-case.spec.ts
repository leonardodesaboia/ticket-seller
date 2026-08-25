import {
  UpdateMemberRoleUseCase,
  MemberNotFoundError,
  LastOwnerProtectionError,
  InvalidRoleError,
  InsufficientRoleToAssignError,
} from './update-member-role.use-case';
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

describe('UpdateMemberRoleUseCase', () => {
  let useCase: UpdateMemberRoleUseCase;
  let repo: jest.Mocked<IOrganizationInvitationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpdateMemberRoleUseCase(repo);
  });

  it('should update member role when valid', async () => {
    repo.updateMemberRoleAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'FINANCE', actorUserId: 'actor-user' });

    expect(repo.updateMemberRoleAtomically).toHaveBeenCalledWith('member-1', 'org-1', 'FINANCE');
  });

  it('should throw InvalidRoleError for invalid role', async () => {
    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'GOD_MODE', actorUserId: 'actor-user' }),
    ).rejects.toBeInstanceOf(InvalidRoleError);
  });

  it('should throw MemberNotFoundError when atomic method raises it', async () => {
    repo.updateMemberRoleAtomically.mockRejectedValue(new MemberNotFoundError());

    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'unknown', newRole: 'ADMIN', actorUserId: 'actor-user' }),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it('should throw LastOwnerProtectionError when demoting the last OWNER', async () => {
    repo.updateMemberRoleAtomically.mockRejectedValue(new LastOwnerProtectionError());

    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'ADMIN', actorUserId: 'actor-user' }),
    ).rejects.toBeInstanceOf(LastOwnerProtectionError);
  });

  it('should allow demoting OWNER when there are multiple owners', async () => {
    repo.updateMemberRoleAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'ADMIN', actorUserId: 'actor-user' });

    expect(repo.updateMemberRoleAtomically).toHaveBeenCalledWith('member-1', 'org-1', 'ADMIN');
  });

  it('should allow promoting to OWNER when actor is an OWNER (has ROLES_ASSIGN)', async () => {
    repo.findActiveMemberByUserId.mockResolvedValue({ id: 'actor-member', role: 'OWNER' });
    repo.updateMemberRoleAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'OWNER', actorUserId: 'actor-user' });

    expect(repo.updateMemberRoleAtomically).toHaveBeenCalledWith('member-1', 'org-1', 'OWNER');
  });

  it('should throw InsufficientRoleToAssignError when non-OWNER actor promotes to OWNER', async () => {
    repo.findActiveMemberByUserId.mockResolvedValue({ id: 'actor-member', role: 'ADMIN' });

    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'OWNER', actorUserId: 'actor-user' }),
    ).rejects.toBeInstanceOf(InsufficientRoleToAssignError);

    expect(repo.updateMemberRoleAtomically).not.toHaveBeenCalled();
  });

  it('should throw InsufficientRoleToAssignError when actor is not an org member and promotes to OWNER', async () => {
    repo.findActiveMemberByUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'OWNER', actorUserId: 'outsider' }),
    ).rejects.toBeInstanceOf(InsufficientRoleToAssignError);
  });

  it('should not call legacy non-atomic methods', async () => {
    repo.updateMemberRoleAtomically.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', memberId: 'member-1', newRole: 'FINANCE', actorUserId: 'actor-user' });

    expect(repo.findMemberById).not.toHaveBeenCalled();
    expect(repo.countActiveOwners).not.toHaveBeenCalled();
    expect(repo.updateMemberRole).not.toHaveBeenCalled();
  });
});
