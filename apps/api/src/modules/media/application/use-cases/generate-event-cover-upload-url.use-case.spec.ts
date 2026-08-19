import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GenerateEventCoverUploadUrlUseCase } from './generate-event-cover-upload-url.use-case';
import { OBJECT_STORAGE_PORT } from '../../../../shared/ports/object-storage.port';
import { MEDIA_UPLOAD_REPOSITORY } from '../../domain/ports/media-upload-repository.port';
import { PrismaService } from '../../../../platform/database/prisma.service';

describe('GenerateEventCoverUploadUrlUseCase', () => {
  let useCase: GenerateEventCoverUploadUrlUseCase;

  const mockStorage = {
    generateUploadUrl: jest.fn(),
    generateDownloadUrl: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };

  const mockRepo = {
    create: jest.fn(),
    findByObjectKey: jest.fn(),
    findPendingByEntityAndOrg: jest.fn(),
    update: jest.fn(),
  };

  const mockPrisma = {
    event: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateEventCoverUploadUrlUseCase,
        { provide: OBJECT_STORAGE_PORT, useValue: mockStorage },
        { provide: MEDIA_UPLOAD_REPOSITORY, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get(GenerateEventCoverUploadUrlUseCase);
    jest.clearAllMocks();
  });

  it('should throw BadRequestException for invalid content-type', async () => {
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'event-1',
        uploaderId: 'user-1',
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when event does not belong to the organization', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'event-from-another-org',
        uploaderId: 'user-1',
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(mockStorage.generateUploadUrl).not.toHaveBeenCalled();
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should generate upload URL and create MediaUpload for valid content-type', async () => {
    const expectedUrl = 'https://minio.example.com/presigned-url';
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1' });
    mockStorage.generateUploadUrl.mockResolvedValue(expectedUrl);
    mockRepo.create.mockResolvedValue({
      id: 'upload-1',
      objectKey: 'uploads/org-1/event-cover/event-1/some-uuid.jpg',
      status: 'PENDING',
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'event-1',
      uploaderId: 'user-1',
      contentType: 'image/jpeg',
    });

    expect(result.uploadUrl).toBe(expectedUrl);
    expect(result.key).toMatch(/^uploads\/org-1\/event-cover\/event-1\/.+\.jpg$/);
    expect(result.expiresIn).toBe(300);
    expect(mockStorage.generateUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        entityId: 'event-1',
        purpose: 'EVENT_COVER',
        contentType: 'image/jpeg',
      }),
    );
  });

  it('should accept image/png and image/webp', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1' });
    mockStorage.generateUploadUrl.mockResolvedValue('https://url');
    mockRepo.create.mockResolvedValue({});

    for (const ct of ['image/png', 'image/webp']) {
      await expect(
        useCase.execute({
          organizationId: 'org-1',
          eventId: 'event-1',
          uploaderId: 'user-1',
          contentType: ct,
        }),
      ).resolves.not.toThrow();
    }
  });
});
