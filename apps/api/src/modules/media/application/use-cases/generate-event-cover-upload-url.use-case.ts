import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  OBJECT_STORAGE_PORT,
  type IObjectStoragePort,
} from '../../../../shared/ports/object-storage.port';
import {
  MEDIA_UPLOAD_REPOSITORY,
  type IMediaUploadRepository,
} from '../../domain/ports/media-upload-repository.port';
import {
  ALLOWED_CONTENT_TYPES,
  type AllowedContentType,
} from '../../domain/media.constants';

const CONTENT_TYPE_EXTENSIONS: Record<AllowedContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const UPLOAD_EXPIRES_IN_SECONDS = 300;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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

@Injectable()
export class GenerateEventCoverUploadUrlUseCase {
  constructor(
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: IObjectStoragePort,
    @Inject(MEDIA_UPLOAD_REPOSITORY)
    private readonly mediaUploadRepo: IMediaUploadRepository,
  ) {}

  async execute(
    command: GenerateEventCoverUploadUrlCommand,
  ): Promise<GenerateEventCoverUploadUrlResult> {
    const { organizationId, eventId, uploaderId, contentType } = command;

    if (!ALLOWED_CONTENT_TYPES.includes(contentType as AllowedContentType)) {
      throw new BadRequestException(
        `Content-Type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    const ext = CONTENT_TYPE_EXTENSIONS[contentType as AllowedContentType];
    const key = `uploads/${organizationId}/event-cover/${eventId}/${randomUUID()}.${ext}`;

    const uploadUrl = await this.storage.generateUploadUrl({
      key,
      contentType,
      maxBytes: MAX_BYTES,
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
