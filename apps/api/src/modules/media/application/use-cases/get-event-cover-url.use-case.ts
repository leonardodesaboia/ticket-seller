import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  OBJECT_STORAGE_PORT,
  type IObjectStoragePort,
} from '../../../../shared/ports/object-storage.port';

const DOWNLOAD_URL_EXPIRES_IN = 3600;

export interface GetEventCoverUrlCommand {
  organizationId: string;
  eventId: string;
}

export interface GetEventCoverUrlResult {
  url: string;
}

@Injectable()
export class GetEventCoverUrlUseCase {
  constructor(
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: IObjectStoragePort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: GetEventCoverUrlCommand): Promise<GetEventCoverUrlResult> {
    const { eventId, organizationId } = command;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId, organizationId },
      select: { coverImageKey: true },
    });

    if (!event || !event.coverImageKey) {
      throw new NotFoundException('Event cover image not found');
    }

    const url = await this.storage.generateDownloadUrl({
      key: event.coverImageKey,
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN,
    });

    return { url };
  }
}
