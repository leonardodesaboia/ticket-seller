import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { MediaUpload } from '../../domain/entities/media-upload.entity';
import type {
  IMediaUploadRepository,
  CreateMediaUploadParams,
  UpdateMediaUploadParams,
} from '../../domain/ports/media-upload-repository.port';

const VALID_PURPOSES = ['EVENT_COVER', 'ORG_LOGO'] as const;
const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'ORPHANED'] as const;

function toDomain(record: {
  id: string;
  organizationId: string;
  uploaderId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: bigint | null;
  purpose: string;
  entityId: string;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
}): MediaUpload {
  if (!VALID_PURPOSES.includes(record.purpose as (typeof VALID_PURPOSES)[number])) {
    throw new Error(`Unknown media upload purpose: ${record.purpose}`);
  }
  if (!VALID_STATUSES.includes(record.status as (typeof VALID_STATUSES)[number])) {
    throw new Error(`Unknown media upload status: ${record.status}`);
  }
  return new MediaUpload({
    id: record.id,
    organizationId: record.organizationId,
    uploaderId: record.uploaderId,
    objectKey: record.objectKey,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    purpose: record.purpose as 'EVENT_COVER' | 'ORG_LOGO',
    entityId: record.entityId,
    status: record.status as 'PENDING' | 'CONFIRMED' | 'ORPHANED',
    confirmedAt: record.confirmedAt,
    createdAt: record.createdAt,
  });
}

@Injectable()
export class PrismaMediaUploadRepository implements IMediaUploadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateMediaUploadParams): Promise<MediaUpload> {
    const record = await this.prisma.mediaUpload.create({
      data: {
        organizationId: params.organizationId,
        uploaderId: params.uploaderId,
        objectKey: params.objectKey,
        contentType: params.contentType,
        purpose: params.purpose,
        entityId: params.entityId,
      },
    });
    return toDomain(record);
  }

  async findByObjectKey(key: string): Promise<MediaUpload | null> {
    const record = await this.prisma.mediaUpload.findUnique({
      where: { objectKey: key },
    });
    return record ? toDomain(record) : null;
  }

  async findPendingByEntityAndOrg(
    entityId: string,
    organizationId: string,
  ): Promise<MediaUpload | null> {
    const record = await this.prisma.mediaUpload.findFirst({
      where: { entityId, organizationId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return record ? toDomain(record) : null;
  }

  async update(id: string, params: UpdateMediaUploadParams): Promise<MediaUpload> {
    const data: {
      status: string;
      sizeBytes?: bigint | null;
      confirmedAt?: Date | null;
    } = { status: params.status };

    if (params.sizeBytes !== undefined) {
      data.sizeBytes = params.sizeBytes;
    }
    if (params.confirmedAt !== undefined) {
      data.confirmedAt = params.confirmedAt;
    }

    const record = await this.prisma.mediaUpload.update({
      where: { id },
      data,
    });
    return toDomain(record);
  }
}
