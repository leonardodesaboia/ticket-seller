import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OBJECT_STORAGE_PORT,
  type IObjectStoragePort,
} from '../../../../shared/ports/object-storage.port';
import {
  MEDIA_UPLOAD_REPOSITORY,
  type IMediaUploadRepository,
} from '../../domain/ports/media-upload-repository.port';
import {
  EVENT_COVER_REPOSITORY,
  type IEventCoverRepository,
} from '../../domain/ports/event-cover-repository.port';
import {
  ALLOWED_CONTENT_TYPES,
  DOWNLOAD_URL_EXPIRES_IN_SECONDS,
  MAX_UPLOAD_SIZE_BYTES,
} from '../../domain/media.constants';

export interface ConfirmEventCoverUploadCommand {
  organizationId: string;
  eventId: string;
  key: string;
}

export interface ConfirmEventCoverUploadResult {
  key: string;
  url: string;
}

@Injectable()
export class ConfirmEventCoverUploadUseCase {
  private readonly logger = new Logger(ConfirmEventCoverUploadUseCase.name);

  constructor(
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: IObjectStoragePort,
    @Inject(MEDIA_UPLOAD_REPOSITORY)
    private readonly mediaUploadRepo: IMediaUploadRepository,
    @Inject(EVENT_COVER_REPOSITORY)
    private readonly eventCoverRepo: IEventCoverRepository,
  ) {}

  async execute(
    command: ConfirmEventCoverUploadCommand,
  ): Promise<ConfirmEventCoverUploadResult> {
    const { organizationId, eventId, key } = command;

    const upload = await this.mediaUploadRepo.findByObjectKey(key);

    if (
      !upload ||
      upload.status !== 'PENDING' ||
      upload.organizationId !== organizationId ||
      upload.entityId !== eventId
    ) {
      throw new NotFoundException('Media upload not found or already processed');
    }

    const metadata = await this.storage.headObject(key);
    if (!metadata) {
      throw new BadRequestException('Object not found in storage — upload may have failed');
    }

    const normalizedContentType = (metadata.contentType.split(';')[0] ?? '').trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(normalizedContentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
      throw new BadRequestException(
        `Uploaded file content-type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    if (metadata.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      try {
        await this.storage.deleteObject(key);
      } catch (deleteErr) {
        this.logger.warn(`Failed to delete oversized object key=${key}: ${String(deleteErr)}`);
      }
      throw new BadRequestException(
        `File size ${metadata.sizeBytes} bytes exceeds maximum of ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024} MB`,
      );
    }

    await this.mediaUploadRepo.update(upload.id, {
      status: 'CONFIRMED',
      sizeBytes: BigInt(metadata.sizeBytes),
      confirmedAt: new Date(),
    });

    await this.eventCoverRepo.updateCoverKey(eventId, organizationId, key);

    const url = await this.storage.generateDownloadUrl({
      key,
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return { key, url };
  }
}
