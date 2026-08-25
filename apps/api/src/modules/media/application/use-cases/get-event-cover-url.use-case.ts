import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  OBJECT_STORAGE_PORT,
  type IObjectStoragePort,
} from '../../../../shared/ports/object-storage.port';
import {
  EVENT_COVER_REPOSITORY,
  type IEventCoverRepository,
} from '../../domain/ports/event-cover-repository.port';
import { DOWNLOAD_URL_EXPIRES_IN_SECONDS } from '../../domain/media.constants';

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
    @Inject(EVENT_COVER_REPOSITORY)
    private readonly eventCoverRepo: IEventCoverRepository,
  ) {}

  async execute(command: GetEventCoverUrlCommand): Promise<GetEventCoverUrlResult> {
    const { eventId, organizationId } = command;

    const event = await this.eventCoverRepo.findByOrganization(eventId, organizationId);

    if (!event || !event.coverImageKey) {
      throw new NotFoundException('Event cover image not found');
    }

    const url = await this.storage.generateDownloadUrl({
      key: event.coverImageKey,
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return { url };
  }
}
