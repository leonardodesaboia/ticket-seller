import { Test } from '@nestjs/testing';
import { SuspendOrganizationUseCase } from './suspend-organization.use-case';
import { PrismaService } from '../../../../platform/database/prisma.service';

describe('SuspendOrganizationUseCase', () => {
  let useCase: SuspendOrganizationUseCase;
  let prisma: jest.Mocked<PrismaService>;

  const mockOrg = { id: 'org-1', suspendedAt: null };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuspendOrganizationUseCase,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    useCase = module.get(SuspendOrganizationUseCase);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('should suspend an active organization', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    (prisma.organization.update as jest.Mock).mockResolvedValue({ ...mockOrg, suspendedAt: new Date() });

    await useCase.execute({
      actorId: 'admin-1',
      organizationId: 'org-1',
      reason: 'Policy violation',
    });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { suspendedAt: expect.any(Date) },
    });
  });

  it('should be idempotent when organization is already suspended', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrg,
      suspendedAt: new Date(),
    });

    await useCase.execute({
      actorId: 'admin-1',
      organizationId: 'org-1',
      reason: 'Policy violation',
    });

    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
