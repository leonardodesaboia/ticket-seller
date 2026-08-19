export interface ObjectMetadata {
  key: string;
  contentType: string;
  sizeBytes: number;
}

export interface IObjectStoragePort {
  generateUploadUrl(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds?: number;
  }): Promise<string>;

  generateDownloadUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }): Promise<string>;

  headObject(key: string): Promise<ObjectMetadata | null>;
  deleteObject(key: string): Promise<void>;
}

export const OBJECT_STORAGE_PORT = Symbol('OBJECT_STORAGE_PORT');
