import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OBJECT_STORAGE_PORT, type IObjectStoragePort } from '../../shared/ports/object-storage.port';
import { MEDIA_UPLOAD_REPOSITORY, type IMediaUploadRepository } from './domain/ports/media-upload-repository.port';
import { EVENT_COVER_REPOSITORY, type IEventCoverRepository } from './domain/ports/event-cover-repository.port';
import { MinioObjectStorageAdapter } from './infrastructure/adapters/minio-object-storage.adapter';
import { S3ObjectStorageAdapter } from './infrastructure/adapters/s3-object-storage.adapter';
import { PrismaMediaUploadRepository } from './infrastructure/repositories/prisma-media-upload.repository';
import { PrismaEventCoverRepository } from './infrastructure/repositories/prisma-event-cover.repository';
import { GenerateEventCoverUploadUrlUseCase } from './application/use-cases/generate-event-cover-upload-url.use-case';
import { ConfirmEventCoverUploadUseCase } from './application/use-cases/confirm-event-cover-upload.use-case';
import { GetEventCoverUrlUseCase } from './application/use-cases/get-event-cover-url.use-case';
import { EventCoverController } from './presentation/controllers/event-cover.controller';
import { env } from '../../platform/config/env';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';

const objectStorageProvider = {
  provide: OBJECT_STORAGE_PORT,
  useClass: env.OBJECT_STORAGE_PROVIDER === 's3' ? S3ObjectStorageAdapter : MinioObjectStorageAdapter,
};

@Module({
  imports: [HttpModule, OrganizationsModule],
  controllers: [EventCoverController],
  providers: [
    OrganizationRoleGuard,
    objectStorageProvider,
    { provide: MEDIA_UPLOAD_REPOSITORY, useClass: PrismaMediaUploadRepository },
    PrismaEventCoverRepository,
    { provide: EVENT_COVER_REPOSITORY, useExisting: PrismaEventCoverRepository },
    {
      provide: GenerateEventCoverUploadUrlUseCase,
      useFactory: (storage: IObjectStoragePort, mediaUploadRepo: IMediaUploadRepository, eventCoverRepo: IEventCoverRepository) =>
        new GenerateEventCoverUploadUrlUseCase(storage, mediaUploadRepo, eventCoverRepo),
      inject: [OBJECT_STORAGE_PORT, MEDIA_UPLOAD_REPOSITORY, EVENT_COVER_REPOSITORY],
    },
    {
      provide: ConfirmEventCoverUploadUseCase,
      useFactory: (storage: IObjectStoragePort, mediaUploadRepo: IMediaUploadRepository, eventCoverRepo: IEventCoverRepository) =>
        new ConfirmEventCoverUploadUseCase(storage, mediaUploadRepo, eventCoverRepo, new NestLoggerAdapter('ConfirmEventCoverUploadUseCase')),
      inject: [OBJECT_STORAGE_PORT, MEDIA_UPLOAD_REPOSITORY, EVENT_COVER_REPOSITORY],
    },
    {
      provide: GetEventCoverUrlUseCase,
      useFactory: (storage: IObjectStoragePort, eventCoverRepo: IEventCoverRepository) =>
        new GetEventCoverUrlUseCase(storage, eventCoverRepo),
      inject: [OBJECT_STORAGE_PORT, EVENT_COVER_REPOSITORY],
    },
  ],
})
export class MediaModule {}
