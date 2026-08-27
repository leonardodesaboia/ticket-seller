import type { IObjectStoragePort } from '../../../../shared/ports/object-storage.port';
import type { IMediaUploadRepository } from '../../domain/ports/media-upload-repository.port';
import type { IEventCoverRepository } from '../../domain/ports/event-cover-repository.port';
import {
  ALLOWED_CONTENT_TYPES,
  DOWNLOAD_URL_EXPIRES_IN_SECONDS,
  MAX_UPLOAD_SIZE_BYTES,
} from '../../domain/media.constants';
import { NotFoundError, ValidationError } from '../../../../shared/kernel/application-errors';
import type { ILogger } from '../../../../shared/kernel/logger.port';

export interface ConfirmEventCoverUploadCommand {
  organizationId: string;
  eventId: string;
  key: string;
}

export interface ConfirmEventCoverUploadResult {
  key: string;
  url: string;
}

export class ConfirmEventCoverUploadUseCase {
  constructor(
    private readonly storage: IObjectStoragePort,
    private readonly mediaUploadRepo: IMediaUploadRepository,
    private readonly eventCoverRepo: IEventCoverRepository,
    private readonly logger: ILogger,
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
      throw new NotFoundError('Media upload not found or already processed');
    }

    const metadata = await this.storage.headObject(key);
    if (!metadata) {
      throw new ValidationError('Object not found in storage — upload may have failed');
    }

    const normalizedContentType = (metadata.contentType.split(';')[0] ?? '').trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(normalizedContentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
      throw new ValidationError(
        `Uploaded file content-type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    if (metadata.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      try {
        await this.storage.deleteObject(key);
      } catch (deleteErr) {
        this.logger.warn(`Failed to delete oversized object key=${key}: ${String(deleteErr)}`);
      }
      throw new ValidationError(
        `File size ${metadata.sizeBytes} bytes exceeds maximum of ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024} MB`,
      );
    }

    upload.confirm(metadata.sizeBytes);

    await this.mediaUploadRepo.update(upload.id, {
      status: upload.status,
      // Non-null: confirm() guarantees sizeBytes and confirmedAt are set
      sizeBytes: upload.sizeBytes!,
      confirmedAt: upload.confirmedAt!,
    });

    await this.eventCoverRepo.updateCoverKey(eventId, organizationId, key);

    const url = await this.storage.generateDownloadUrl({
      key,
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return { key, url };
  }
}
