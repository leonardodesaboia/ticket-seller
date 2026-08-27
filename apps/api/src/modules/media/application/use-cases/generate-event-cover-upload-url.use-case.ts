import { randomUUID } from 'crypto';
import type { IObjectStoragePort } from '../../../../shared/ports/object-storage.port';
import type { IMediaUploadRepository } from '../../domain/ports/media-upload-repository.port';
import type { IEventCoverRepository } from '../../domain/ports/event-cover-repository.port';
import {
  ALLOWED_CONTENT_TYPES,
  type AllowedContentType,
  MAX_UPLOAD_SIZE_BYTES,
} from '../../domain/media.constants';
import { NotFoundError, ValidationError } from '../../../../shared/kernel/application-errors';

const CONTENT_TYPE_EXTENSIONS: Record<AllowedContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const UPLOAD_EXPIRES_IN_SECONDS = 300;

export interface GenerateEventCoverUploadUrlCommand {
  organizationId: string;
  eventId: string;
  uploaderId: string;
  contentType: string;
}

export interface GenerateEventCoverUploadUrlResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export class GenerateEventCoverUploadUrlUseCase {
  constructor(
    private readonly storage: IObjectStoragePort,
    private readonly mediaUploadRepo: IMediaUploadRepository,
    private readonly eventCoverRepo: IEventCoverRepository,
  ) {}

  async execute(
    command: GenerateEventCoverUploadUrlCommand,
  ): Promise<GenerateEventCoverUploadUrlResult> {
    const { organizationId, eventId, uploaderId, contentType } = command;

    if (!ALLOWED_CONTENT_TYPES.includes(contentType as AllowedContentType)) {
      throw new ValidationError(
        `Content-Type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    const exists = await this.eventCoverRepo.existsInOrganization(eventId, organizationId);
    if (!exists) {
      throw new NotFoundError('Event not found in this organization');
    }

    const ext = CONTENT_TYPE_EXTENSIONS[contentType as AllowedContentType];
    const key = `uploads/${organizationId}/event-cover/${eventId}/${randomUUID()}.${ext}`;

    const uploadUrl = await this.storage.generateUploadUrl({
      key,
      contentType,
      maxBytes: MAX_UPLOAD_SIZE_BYTES,
      expiresInSeconds: UPLOAD_EXPIRES_IN_SECONDS,
    });

    await this.mediaUploadRepo.create({
      organizationId,
      uploaderId,
      objectKey: key,
      contentType,
      purpose: 'EVENT_COVER',
      entityId: eventId,
    });

    return { uploadUrl, key, expiresIn: UPLOAD_EXPIRES_IN_SECONDS };
  }
}
