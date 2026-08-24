import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { env } from '../../../../platform/config/env';
import type { IObjectStoragePort, ObjectMetadata } from '../../../../shared/ports/object-storage.port';

@Injectable()
export class MinioObjectStorageAdapter implements IObjectStoragePort, OnModuleInit {
  private readonly logger = new Logger(MinioObjectStorageAdapter.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor() {
    const endpointUrl = new URL(env.MINIO_ENDPOINT);
    this.bucket = env.MINIO_BUCKET;

    this.client = new Client({
      endPoint: endpointUrl.hostname,
      port: endpointUrl.port ? parseInt(endpointUrl.port, 10) : (endpointUrl.protocol === 'https:' ? 443 : 80),
      useSSL: endpointUrl.protocol === 'https:',
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      } else {
        this.logger.log(`MinIO bucket exists: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.error(`Failed to initialize MinIO bucket: ${String(err)}`);
    }
  }

  async generateUploadUrl(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds?: number;
  }): Promise<string> {
    const expiresIn = params.expiresInSeconds ?? 300;
    return this.client.presignedPutObject(this.bucket, params.key, expiresIn);
  }

  async generateDownloadUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const expiresIn = params.expiresInSeconds ?? 3600;
    return this.client.presignedGetObject(this.bucket, params.key, expiresIn);
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const stat = await this.client.statObject(this.bucket, key);
      return {
        key,
        contentType: stat.metaData?.['content-type'] as string ?? 'application/octet-stream',
        sizeBytes: stat.size,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
