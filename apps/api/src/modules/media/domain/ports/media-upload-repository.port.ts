import type { MediaUpload, MediaUploadPurpose, MediaUploadStatus } from '../entities/media-upload.entity';

export interface CreateMediaUploadParams {
  organizationId: string;
  uploaderId: string;
  objectKey: string;
  contentType: string;
  purpose: MediaUploadPurpose;
  entityId: string;
}

export interface UpdateMediaUploadParams {
  status: MediaUploadStatus;
  sizeBytes?: bigint;
  confirmedAt?: Date;
}

export interface IMediaUploadRepository {
  create(params: CreateMediaUploadParams): Promise<MediaUpload>;
  findByObjectKey(key: string): Promise<MediaUpload | null>;
  findPendingByEntityAndOrg(entityId: string, organizationId: string): Promise<MediaUpload | null>;
  update(id: string, params: UpdateMediaUploadParams): Promise<MediaUpload>;
}

export const MEDIA_UPLOAD_REPOSITORY = Symbol('MEDIA_UPLOAD_REPOSITORY');
