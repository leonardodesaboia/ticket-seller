import { InviteOrganizationMemberUseCase, InvalidRoleError, InsufficientRoleToAssignError } from './invite-organization-member.use-case';
import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import type { ILogger } from '../../../../shared/kernel/logger.port';
import { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';

const makeLogger = (): ILogger => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeRepo = (): jest.Mocked<IOrganizationInvitationRepository> => ({
  createInvitation: jest.fn(),
  findInvitationByTokenHash: jest.fn(),
  findInvitationById: jest.fn(),
  findPendingInvitationByEmail: jest.fn().mockResolvedValue(null),
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

const makeInvitation = (): OrganizationInvitation => {
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return new OrganizationInvitation(
    'inv-1',
    'org-1',
    'inviter-1',
    'test@example.com',
    'ADMIN',
    'token-hash',
    expires,
    now,
    null,
    null,
  );
};

describe('InviteOrganizationMemberUseCase', () => {
  let useCase: InviteOrganizationMemberUseCase;
  let repo: jest.Mocked<IOrganizationInvitationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new InviteOrganizationMemberUseCase(repo, makeLogger());
  });

  it('should create invitation for a non-member email', async () => {
    repo.isActiveMember.mockResolvedValue(false);
    repo.findPendingInvitationByEmail.mockResolvedValue(null);
    repo.createInvitation.mockResolvedValue(makeInvitation());

    const result = await useCase.execute({
      organizationId: 'org-1',
      inviterId: 'inviter-1',
      email: 'test@example.com',
      role: 'ADMIN',
    });

    expect(repo.createInvitation).toHaveBeenCalledTimes(1);
    expect(result.email).toBe('test@example.com');
    expect(result.role).toBe('ADMIN');
    expect(result.rawToken).toBeDefined();
  });

  it('should revoke existing pending invitation before creating a new one', async () => {
    const existingInvitation = makeInvitation();
    repo.isActiveMember.mockResolvedValue(false);
    repo.findPendingInvitationByEmail.mockResolvedValue(existingInvitation);
    repo.revokeInvitation.mockResolvedValue(undefined);
    repo.createInvitation.mockResolvedValue(makeInvitation());

    await useCase.execute({
      organizationId: 'org-1',
      inviterId: 'inviter-1',
      email: 'test@example.com',
      role: 'ADMIN',
    });

    expect(repo.revokeInvitation).toHaveBeenCalledWith(existingInvitation.id);
    expect(repo.createInvitation).toHaveBeenCalledTimes(1);
  });

  it('should return synthetic result without DB write when email is already a member (security: no reveal)', async () => {
    repo.isActiveMember.mockResolvedValue(true);

    const result = await useCase.execute({
      organizationId: 'org-1',
      inviterId: 'inviter-1',
      email: 'existing@example.com',
      role: 'ADMIN',
    });

    expect(repo.createInvitation).not.toHaveBeenCalled();
    expect(result.email).toBe('existing@example.com');
  });

  it('should throw InvalidRoleError for unknown role', async () => {
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        inviterId: 'inviter-1',
        email: 'test@example.com',
        role: 'SUPER_HACKER',
      }),
    ).rejects.toBeInstanceOf(InvalidRoleError);
  });

  it('should throw InsufficientRoleToAssignError when non-OWNER tries to invite as OWNER', async () => {
    repo.findActiveMemberByUserId.mockResolvedValue({ id: 'member-1', role: 'ADMIN' });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        inviterId: 'admin-user',
        email: 'test@example.com',
        role: 'OWNER',
      }),
    ).rejects.toBeInstanceOf(InsufficientRoleToAssignError);

    expect(repo.createInvitation).not.toHaveBeenCalled();
  });

  it('should allow OWNER to invite another OWNER', async () => {
    repo.findActiveMemberByUserId.mockResolvedValue({ id: 'member-1', role: 'OWNER' });
    repo.isActiveMember.mockResolvedValue(false);
    repo.createInvitation.mockResolvedValue(makeInvitation());

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        inviterId: 'owner-user',
        email: 'new-owner@example.com',
        role: 'OWNER',
      }),
    ).resolves.toBeDefined();

    expect(repo.createInvitation).toHaveBeenCalledTimes(1);
  });
});
