import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  OBJECT_STORAGE_PORT,
  type IObjectStoragePort,
} from '../../../../shared/ports/object-storage.port';
import {
  MEDIA_UPLOAD_REPOSITORY,
  type IMediaUploadRepository,
} from '../../domain/ports/media-upload-repository.port';
import { ALLOWED_CONTENT_TYPES } from '../../domain/media.constants';

const DOWNLOAD_URL_EXPIRES_IN = 3600;

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
  constructor(
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: IObjectStoragePort,
    @Inject(MEDIA_UPLOAD_REPOSITORY)
    private readonly mediaUploadRepo: IMediaUploadRepository,
    private readonly prisma: PrismaService,
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

    if (!ALLOWED_CONTENT_TYPES.includes(metadata.contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
      throw new BadRequestException(
        `Uploaded file content-type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    await this.mediaUploadRepo.update(upload.id, {
      status: 'CONFIRMED',
      sizeBytes: BigInt(metadata.sizeBytes),
      confirmedAt: new Date(),
    });

    await this.prisma.event.update({
      where: { id: eventId, organizationId },
      data: { coverImageKey: key },
    });

    const url = await this.storage.generateDownloadUrl({
      key,
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN,
    });

    return { key, url };
  }
}
