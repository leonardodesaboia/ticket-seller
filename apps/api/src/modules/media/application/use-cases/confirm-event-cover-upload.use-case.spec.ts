import { NotFoundError, ValidationError } from '../../../../shared/kernel/application-errors';
import type { ILogger } from '../../../../shared/kernel/logger.port';
import { ConfirmEventCoverUploadUseCase } from './confirm-event-cover-upload.use-case';
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

  const mockLogger: ILogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
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

  beforeEach(() => {
    useCase = new ConfirmEventCoverUploadUseCase(mockStorage as any, mockRepo as any, mockEventCoverRepo as any, mockLogger);
    jest.clearAllMocks();
  });

  it('should throw NotFoundError when MediaUpload is not found', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'some-key' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when upload belongs to different org', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload({ organizationId: 'other-org' }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when upload is not PENDING', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload({ status: 'CONFIRMED' }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when headObject returns null', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for disallowed content-type', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue({
      key: 'uploads/org-1/event-cover/event-1/abc.jpg',
      contentType: 'image/gif',
      sizeBytes: 1024,
    });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError and delete object when file exceeds max size', async () => {
    mockRepo.findByObjectKey.mockResolvedValue(makeUpload());
    mockStorage.headObject.mockResolvedValue({
      key: 'uploads/org-1/event-cover/event-1/abc.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 11 * 1024 * 1024, // 11 MB — over limit
    });
    mockStorage.deleteObject.mockResolvedValue(undefined);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', key: 'uploads/org-1/event-cover/event-1/abc.jpg' }),
    ).rejects.toThrow(ValidationError);

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
