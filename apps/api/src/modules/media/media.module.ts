import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { OrganizationRoleGuard } from '../../platform/http/guards/organization-role.guard';
import { ORGANIZATION_INVITATION_REPOSITORY } from '../organizations/domain/ports/organization-invitation-repository.port';
import { PrismaOrganizationInvitationRepository } from '../organizations/infrastructure/repositories/prisma-organization-invitation.repository';
import { OBJECT_STORAGE_PORT } from '../../shared/ports/object-storage.port';
import { MEDIA_UPLOAD_REPOSITORY } from './domain/ports/media-upload-repository.port';
import { MinioObjectStorageAdapter } from './infrastructure/adapters/minio-object-storage.adapter';
import { S3ObjectStorageAdapter } from './infrastructure/adapters/s3-object-storage.adapter';
import { PrismaMediaUploadRepository } from './infrastructure/repositories/prisma-media-upload.repository';
import { GenerateEventCoverUploadUrlUseCase } from './application/use-cases/generate-event-cover-upload-url.use-case';
import { ConfirmEventCoverUploadUseCase } from './application/use-cases/confirm-event-cover-upload.use-case';
import { GetEventCoverUrlUseCase } from './application/use-cases/get-event-cover-url.use-case';
import { EventCoverController } from './presentation/controllers/event-cover.controller';
import { env } from '../../platform/config/env';

const objectStorageProvider = {
  provide: OBJECT_STORAGE_PORT,
  useClass: env.OBJECT_STORAGE_PROVIDER === 's3' ? S3ObjectStorageAdapter : MinioObjectStorageAdapter,
};

@Module({
  imports: [HttpModule],
  controllers: [EventCoverController],
  providers: [
    OrganizationRoleGuard,
    objectStorageProvider,
    { provide: MEDIA_UPLOAD_REPOSITORY, useClass: PrismaMediaUploadRepository },
    // Required by OrganizationRoleGuard which is registered in this module
    { provide: ORGANIZATION_INVITATION_REPOSITORY, useClass: PrismaOrganizationInvitationRepository },
    GenerateEventCoverUploadUrlUseCase,
    ConfirmEventCoverUploadUseCase,
    GetEventCoverUrlUseCase,
  ],
})
export class MediaModule {}
