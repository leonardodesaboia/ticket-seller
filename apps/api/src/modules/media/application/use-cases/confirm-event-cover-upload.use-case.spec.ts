import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmEventCoverUploadUseCase } from './confirm-event-cover-upload.use-case';
import { OBJECT_STORAGE_PORT } from '../../../../shared/ports/object-storage.port';
import { MEDIA_UPLOAD_REPOSITORY } from '../../domain/ports/media-upload-repository.port';
import { PrismaService } from '../../../../platform/database/prisma.service';

describe('ConfirmEventCoverUploadUseCase', () => {
  let useCase: ConfirmEventCoverUploadUseCase;

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
    event: {
      update: jest.fn(),
    },
  };

  const validUpload = {
    id: 'upload-1',
    organizationId: 'org-1',
    entityId: 'event-1',
    objectKey: 'uploads/org-1/event-cover/event-1/abc.jpg',
    status: 'PENDING',
    contentType: 'image/jpeg',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmEventCoverUploadUseCase,
        { provide: OBJECT_STORAGE_PORT, useValue: mockStorage },
        { provide: MEDIA_UPLOAD_REPOSITORY, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get(ConfirmEventCoverUploadUseCase);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when MediaUpload is not found', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'some-key' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when upload belongs to different org', async () => {
    mockRepo.findByObjectKey.mockResolvedValue({ ...validUpload, organizationId: 'other-org' });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: validUpload.objectKey }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when upload is not PENDING', async () => {
    mockRepo.findByObjectKey.mockResolvedValue({ ...validUpload, status: 'CONFIRMED' });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: validUpload.objectKey }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when headObject returns null', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(validUpload);
    mockStorage.headObject.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: validUpload.objectKey }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for disallowed content-type', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(validUpload);
    mockStorage.headObject.mockResolvedValue({
      key: validUpload.objectKey,
      contentType: 'image/gif',
      sizeBytes: 1024,
    });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: validUpload.objectKey }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should confirm upload and update event on success', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(validUpload);
    mockStorage.headObject.mockResolvedValue({
      key: validUpload.objectKey,
      contentType: 'image/jpeg',
      sizeBytes: 102400,
    });
    mockRepo.update.mockResolvedValue({ ...validUpload, status: 'CONFIRMED' });
    mockPrisma.event.update.mockResolvedValue({});
    mockStorage.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/image.jpg');

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'event-1',
      key: validUpload.objectKey,
    });

    expect(result.key).toBe(validUpload.objectKey);
    expect(result.url).toBe('https://cdn.example.com/image.jpg');
    expect(mockRepo.update).toHaveBeenCalledWith('upload-1', expect.objectContaining({ status: 'CONFIRMED' }));
    expect(mockPrisma.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1', organizationId: 'org-1' },
      data: { coverImageKey: validUpload.objectKey },
    });
  });
});
