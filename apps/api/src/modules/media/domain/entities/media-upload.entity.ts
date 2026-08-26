export type MediaUploadPurpose = 'EVENT_COVER' | 'ORG_LOGO';
export type MediaUploadStatus = 'PENDING' | 'CONFIRMED' | 'ORPHANED';

/** PENDING uploads older than this threshold are considered expired. */
const EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  sizeBytes: bigint | null;
  readonly purpose: MediaUploadPurpose;
  readonly entityId: string;
  status: MediaUploadStatus;
  confirmedAt: Date | null;
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

  /**
   * Transitions the upload to CONFIRMED, recording the actual file size and
   * confirmation timestamp.
   * Throws if the upload is not currently in PENDING state.
   */
  confirm(sizeBytes: number): void {
    if (this.status !== 'PENDING') {
      throw new Error(`Cannot confirm upload in status '${this.status}'`);
    }
    this.status = 'CONFIRMED';
    this.sizeBytes = BigInt(sizeBytes);
    this.confirmedAt = new Date();
  }

  /**
   * Transitions the upload to ORPHANED (object exists in storage but is no
   * longer referenced by any entity).
   */
  markOrphaned(): void {
    this.status = 'ORPHANED';
  }

  /**
   * Returns true when the upload has been PENDING longer than 24 hours,
   * meaning the client never completed the presigned upload.
   */
  isExpired(): boolean {
    return (
      this.status === 'PENDING' &&
      Date.now() - this.createdAt.getTime() > EXPIRY_THRESHOLD_MS
    );
  }
}
