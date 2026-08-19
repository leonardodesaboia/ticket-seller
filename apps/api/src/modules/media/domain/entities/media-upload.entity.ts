export type MediaUploadPurpose = 'EVENT_COVER' | 'ORG_LOGO';
export type MediaUploadStatus = 'PENDING' | 'CONFIRMED' | 'ORPHANED';

export interface MediaUploadProps {
  id: string;
  organizationId: string;
  uploaderId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: bigint | null;
  purpose: MediaUploadPurpose;
  entityId: string;
  status: MediaUploadStatus;
  confirmedAt: Date | null;
  createdAt: Date;
}

export class MediaUpload {
  readonly id: string;
  readonly organizationId: string;
  readonly uploaderId: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: bigint | null;
  readonly purpose: MediaUploadPurpose;
  readonly entityId: string;
  readonly status: MediaUploadStatus;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: MediaUploadProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.uploaderId = props.uploaderId;
    this.objectKey = props.objectKey;
    this.contentType = props.contentType;
    this.sizeBytes = props.sizeBytes;
    this.purpose = props.purpose;
    this.entityId = props.entityId;
    this.status = props.status;
    this.confirmedAt = props.confirmedAt;
    this.createdAt = props.createdAt;
  }
}
