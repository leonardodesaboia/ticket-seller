import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetEventCoverUrlUseCase } from './get-event-cover-url.use-case';
import { OBJECT_STORAGE_PORT } from '../../../../shared/ports/object-storage.port';
import { EVENT_COVER_REPOSITORY } from '../../domain/ports/event-cover-repository.port';

describe('GetEventCoverUrlUseCase', () => {
  let useCase: GetEventCoverUrlUseCase;

  const mockStorage = {
    generateUploadUrl: jest.fn(),
    generateDownloadUrl: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };

  const mockEventCoverRepo = {
    existsInOrganization: jest.fn(),
    findByOrganization: jest.fn(),
    updateCoverKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEventCoverUrlUseCase,
        { provide: OBJECT_STORAGE_PORT, useValue: mockStorage },
        { provide: EVENT_COVER_REPOSITORY, useValue: mockEventCoverRepo },
      ],
    }).compile();

    useCase = module.get(GetEventCoverUrlUseCase);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when event is not found', async () => {
    mockEventCoverRepo.findByOrganization.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockEventCoverRepo.findByOrganization).toHaveBeenCalledWith('event-1', 'org-1');
  });

  it('should throw NotFoundException when event has no cover image', async () => {
    mockEventCoverRepo.findByOrganization.mockResolvedValue({ coverImageKey: null });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return a download URL for an event in the correct organization', async () => {
    const key = 'uploads/org-1/event-cover/event-1/abc.jpg';
    mockEventCoverRepo.findByOrganization.mockResolvedValue({ coverImageKey: key });
    mockStorage.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/image.jpg');

    const result = await useCase.execute({ organizationId: 'org-1', eventId: 'event-1' });

    expect(result.url).toBe('https://cdn.example.com/image.jpg');
    expect(mockEventCoverRepo.findByOrganization).toHaveBeenCalledWith('event-1', 'org-1');
    expect(mockStorage.generateDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key }),
    );
  });

  it('should not return URL for event belonging to a different organization', async () => {
    // repository filters by organizationId — returns null for cross-org access
    mockEventCoverRepo.findByOrganization.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'other-org', eventId: 'event-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});
