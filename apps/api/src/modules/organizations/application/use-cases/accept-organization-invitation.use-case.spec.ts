import {
  AcceptOrganizationInvitationUseCase,
  InvitationNotFoundError,
  InvitationAlreadyUsedError,
  InvitationRevokedError,
  InvitationExpiredError,
} from './accept-organization-invitation.use-case';
import type { IOrganizationInvitationRepository } from '../../domain/ports/organization-invitation-repository.port';
import { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';
import { createHash } from 'crypto';

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

const RAW_TOKEN = 'test-raw-token-abc';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

const makeInvitation = (overrides: {
  usedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt?: Date;
} = {}): OrganizationInvitation => {
  const now = new Date();
  const expires = overrides.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return new OrganizationInvitation(
    'inv-1',
    'org-1',
    'inviter-1',
    'test@example.com',
    'ADMIN',
    TOKEN_HASH,
    expires,
    now,
    overrides.usedAt ?? null,
    overrides.revokedAt ?? null,
  );
};

describe('AcceptOrganizationInvitationUseCase', () => {
  let useCase: AcceptOrganizationInvitationUseCase;
  let repo: jest.Mocked<IOrganizationInvitationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new AcceptOrganizationInvitationUseCase(repo);
  });

  it('should accept a valid invitation', async () => {
    const invitation = makeInvitation();
    repo.findInvitationByTokenHash.mockResolvedValue(invitation);
    repo.markInvitationUsed.mockResolvedValue(undefined);

    const result = await useCase.execute({ rawToken: RAW_TOKEN, userId: 'user-1' });

    expect(result.organizationId).toBe('org-1');
    expect(result.role).toBe('ADMIN');
    expect(repo.markInvitationUsed).toHaveBeenCalledWith('inv-1', 'user-1');
  });

  it('should throw InvitationNotFoundError for unknown token', async () => {
    repo.findInvitationByTokenHash.mockResolvedValue(null);
    await expect(useCase.execute({ rawToken: 'bad-token' })).rejects.toBeInstanceOf(
      InvitationNotFoundError,
    );
  });

  it('should throw InvitationAlreadyUsedError when usedAt is set', async () => {
    repo.findInvitationByTokenHash.mockResolvedValue(makeInvitation({ usedAt: new Date() }));
    await expect(useCase.execute({ rawToken: RAW_TOKEN })).rejects.toBeInstanceOf(
      InvitationAlreadyUsedError,
    );
  });

  it('should throw InvitationRevokedError when revokedAt is set', async () => {
    repo.findInvitationByTokenHash.mockResolvedValue(makeInvitation({ revokedAt: new Date() }));
    await expect(useCase.execute({ rawToken: RAW_TOKEN })).rejects.toBeInstanceOf(
      InvitationRevokedError,
    );
  });

  it('should throw InvitationExpiredError when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000);
    repo.findInvitationByTokenHash.mockResolvedValue(makeInvitation({ expiresAt: pastDate }));
    await expect(useCase.execute({ rawToken: RAW_TOKEN })).rejects.toBeInstanceOf(
      InvitationExpiredError,
    );
  });
});
