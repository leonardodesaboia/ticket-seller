import { InviteOrganizationMemberUseCase, InvalidRoleError } from './invite-organization-member.use-case';
import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';

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
    useCase = new InviteOrganizationMemberUseCase(repo);
  });

  it('should create invitation for a non-member email', async () => {
    repo.isActiveMember.mockResolvedValue(false);
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
});
