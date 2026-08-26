import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmEventCoverUploadUseCase } from './confirm-event-cover-upload.use-case';
import { OBJECT_STORAGE_PORT } from '../../../../shared/ports/object-storage.port';
import { MEDIA_UPLOAD_REPOSITORY } from '../../domain/ports/media-upload-repository.port';
import { EVENT_COVER_REPOSITORY } from '../../domain/ports/event-cover-repository.port';
import { MediaUpload } from '../../domain/entities/media-upload.entity';

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

  const mockEventCoverRepo = {
    existsInOrganization: jest.fn(),
    findByOrganization: jest.fn(),
    updateCoverKey: jest.fn(),
  };

  function makeUpload(overrides: Partial<ConstructorParameters<typeof MediaUpload>[0]> = {}): MediaUpload {
    return new MediaUpload({
      id: 'upload-1',
      organizationId: 'org-1',
      uploaderId: 'user-1',
      objectKey: 'uploads/org-1/event-cover/event-1/abc.jpg',
      contentType: 'image/jpeg',
      sizeBytes: null,
      purpose: 'EVENT_COVER',
      entityId: 'event-1',
      status: 'PENDING',
      confirmedAt: null,
      createdAt: new Date(),
      ...overrides,
    });
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmEventCoverUploadUseCase,
        { provide: OBJECT_STORAGE_PORT, useValue: mockStorage },
        { provide: MEDIA_UPLOAD_REPOSITORY, useValue: mockRepo },
        { provide: EVENT_COVER_REPOSITORY, useValue: mockEventCoverRepo },
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
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload({ organizationId: 'other-org' }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when upload is not PENDING', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload({ status: 'CONFIRMED' }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when headObject returns null', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for disallowed content-type', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue({
      key: 'uploads/org-1/event-cover/event-1/abc.jpg',
      contentType: 'image/gif',
      sizeBytes: 1024,
    });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException and delete object when file exceeds max size', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue({
      key: 'uploads/org-1/event-cover/event-1/abc.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 11 * 1024 * 1024, // 11 MB — over limit
    });
    mockStorage.deleteObject.mockResolvedValue(undefined);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(BadRequestException);

    expect(mockStorage.deleteObject).toHaveBeenCalledWith('uploads/org-1/event-cover/event-1/abc.jpg');
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should confirm upload and update event on success', async () => {
    const objectKey = 'uploads/org-1/event-cover/event-1/abc.jpg';
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue({
      key: objectKey,
      contentType: 'image/jpeg',
      sizeBytes: 102400,
    });
    mockRepo.update.mockResolvedValue(makeUpload({ status: 'CONFIRMED' }));
    mockEventCoverRepo.updateCoverKey.mockResolvedValue(undefined);
    mockStorage.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/image.jpg');

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'event-1',
      key: objectKey,
    });

    expect(result.key).toBe(objectKey);
    expect(result.url).toBe('https://cdn.example.com/image.jpg');
    expect(mockRepo.update).toHaveBeenCalledWith('upload-1', expect.objectContaining({ status: 'CONFIRMED' }));
    expect(mockEventCoverRepo.updateCoverKey).toHaveBeenCalledWith('event-1', 'org-1', objectKey);
  });
});
