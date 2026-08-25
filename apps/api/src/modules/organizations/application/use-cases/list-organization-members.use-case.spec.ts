import { ListOrganizationMembersUseCase } from './list-organization-members.use-case';
import type {
  IOrganizationInvitationRepository,
  OrganizationMemberRecord,
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

const makeMember = (role: string): OrganizationMemberRecord => ({
  id: 'member-1',
  organizationId: 'org-1',
  userId: 'user-1',
  role,
  status: 'ACTIVE',
  joinedAt: new Date(),
  user: { email: 'test@example.com', displayName: 'Test User' },
});

describe('ListOrganizationMembersUseCase', () => {
  let useCase: ListOrganizationMembersUseCase;
  let repo: jest.Mocked<IOrganizationInvitationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new ListOrganizationMembersUseCase(repo);
  });

  it('should list active members for an organization', async () => {
    const members = [makeMember('OWNER'), makeMember('ADMIN')];
    repo.listActiveMembers.mockResolvedValue(members);

    const result = await useCase.execute({ organizationId: 'org-1' });

    expect(result).toHaveLength(2);
    expect(repo.listActiveMembers).toHaveBeenCalledWith('org-1');
  });

  it('should return empty array when no members', async () => {
    repo.listActiveMembers.mockResolvedValue([]);

    const result = await useCase.execute({ organizationId: 'org-1' });

    expect(result).toHaveLength(0);
  });
});
