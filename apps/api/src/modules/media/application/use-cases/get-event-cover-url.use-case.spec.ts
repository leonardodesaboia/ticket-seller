import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetEventCoverUrlUseCase } from './get-event-cover-url.use-case';
import { OBJECT_STORAGE_PORT } from '../../../../shared/ports/object-storage.port';
import { PrismaService } from '../../../../platform/database/prisma.service';

describe('GetEventCoverUrlUseCase', () => {
  let useCase: GetEventCoverUrlUseCase;

  const mockStorage = {
    generateUploadUrl: jest.fn(),
    generateDownloadUrl: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };

  const mockPrisma = {
    event: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEventCoverUrlUseCase,
        { provide: OBJECT_STORAGE_PORT, useValue: mockStorage },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get(GetEventCoverUrlUseCase);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when event is not found', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: 'event-1', organizationId: 'org-1' },
      select: { coverImageKey: true },
    });
  });

  it('should throw NotFoundException when event has no cover image', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ coverImageKey: null });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return a download URL for an event in the correct organization', async () => {
    const key = 'uploads/org-1/event-cover/event-1/abc.jpg';
    mockPrisma.event.findUnique.mockResolvedValue({ coverImageKey: key });
    mockStorage.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/image.jpg');

    const result = await useCase.execute({ organizationId: 'org-1', eventId: 'event-1' });

    expect(result.url).toBe('https://cdn.example.com/image.jpg');
    expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: 'event-1', organizationId: 'org-1' },
      select: { coverImageKey: true },
    });
    expect(mockStorage.generateDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key }),
    );
  });

  it('should not return URL for event belonging to a different organization', async () => {
    // Prisma filters by organizationId in WHERE — returns null for cross-org access
    mockPrisma.event.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'other-org', eventId: 'event-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});
