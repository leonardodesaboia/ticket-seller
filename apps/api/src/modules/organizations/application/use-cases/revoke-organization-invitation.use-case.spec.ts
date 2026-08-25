import {
  RevokeOrganizationInvitationUseCase,
  InvitationNotFoundError,
} from './revoke-organization-invitation.use-case';
import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';

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

const makeInvitation = (revokedAt: Date | null = null): OrganizationInvitation => {
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
    revokedAt,
  );
};

describe('RevokeOrganizationInvitationUseCase', () => {
  let useCase: RevokeOrganizationInvitationUseCase;
  let repo: jest.Mocked<IOrganizationInvitationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new RevokeOrganizationInvitationUseCase(repo);
  });

  it('should revoke a pending invitation', async () => {
    repo.findInvitationById.mockResolvedValue(makeInvitation());
    repo.revokeInvitation.mockResolvedValue(undefined);

    await useCase.execute({ organizationId: 'org-1', invitationId: 'inv-1' });

    expect(repo.revokeInvitation).toHaveBeenCalledWith('inv-1');
  });

  it('should be idempotent — skip revokeInvitation if already revoked', async () => {
    repo.findInvitationById.mockResolvedValue(makeInvitation(new Date()));

    await useCase.execute({ organizationId: 'org-1', invitationId: 'inv-1' });

    expect(repo.revokeInvitation).not.toHaveBeenCalled();
  });

  it('should throw InvitationNotFoundError when invitation does not exist', async () => {
    repo.findInvitationById.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', invitationId: 'unknown' }),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
