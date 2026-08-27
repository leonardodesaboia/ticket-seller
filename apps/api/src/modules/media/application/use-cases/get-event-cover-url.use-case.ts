import type { IObjectStoragePort } from '../../../../shared/ports/object-storage.port';
import type { IEventCoverRepository } from '../../domain/ports/event-cover-repository.port';
import { DOWNLOAD_URL_EXPIRES_IN_SECONDS } from '../../domain/media.constants';
import { NotFoundError } from '../../../../shared/kernel/application-errors';

export interface GetEventCoverUrlCommand {
  organizationId: string;
  eventId: string;
}

export interface GetEventCoverUrlResult {
  url: string;
}

export class GetEventCoverUrlUseCase {
  constructor(
    private readonly storage: IObjectStoragePort,
    private readonly eventCoverRepo: IEventCoverRepository,
  ) {}

  async execute(command: GetEventCoverUrlCommand): Promise<GetEventCoverUrlResult> {
    const { eventId, organizationId } = command;

    const event = await this.eventCoverRepo.findByOrganization(eventId, organizationId);

    if (!event || !event.coverImageKey) {
      throw new NotFoundError('Event cover image not found');
    }

    const url = await this.storage.generateDownloadUrl({
      key: event.coverImageKey,
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return { url };
  }
}
