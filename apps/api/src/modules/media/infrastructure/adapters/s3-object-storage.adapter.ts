import { Injectable } from '@nestjs/common';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../../../platform/config/env';
import type { IObjectStoragePort, ObjectMetadata } from '../../../../shared/ports/object-storage.port';

@Injectable()
export class S3ObjectStorageAdapter implements IObjectStoragePort {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = env.AWS_S3_BUCKET!; // validated at startup: required when OBJECT_STORAGE_PROVIDER=s3
    const clientConfig = env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          region: env.AWS_S3_REGION,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : { region: env.AWS_S3_REGION };

    this.s3Client = new S3Client(clientConfig);
  }

  async generateUploadUrl(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds?: number;
  }): Promise<string> {
    const expiresIn = params.expiresInSeconds ?? 300;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async generateDownloadUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const expiresIn = params.expiresInSeconds ?? 3600;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: params.key });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        contentType: response.ContentType ?? 'application/octet-stream',
        sizeBytes: response.ContentLength ?? 0,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
