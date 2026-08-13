import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  PUBLISH_EVENT_OPERATION_PORT,
  type IPublishEventOperationPort,
  type PublishEventOperationResult,
} from '../ports/publish-event-operation.port';
import {
  EVENT_CREATOR_ROLES,
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../domain/event.errors';

export interface PublishEventCommand {
  organizationId: string;
  eventId: string;
  actorId: string;
  idempotencyKey: string;
  expectedVersion: number;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function hashRequest(command: PublishEventCommand): string {
  const payload = JSON.stringify({
    organizationId: command.organizationId,
    eventId: command.eventId,
    actorId: command.actorId,
    expectedVersion: command.expectedVersion,
  });
  return createHash('sha256').update(payload).digest('hex');
}

@Injectable()
export class PublishEventUseCase {
  constructor(
    @Inject(PUBLISH_EVENT_OPERATION_PORT)
    private readonly publishOperation: IPublishEventOperationPort,
    @Inject(ORGANIZATION_ACCESS_PORT)
    private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: PublishEventCommand): Promise<PublishEventOperationResult> {
    // Authorization happens before any idempotent replay so that an outsider or
    // insufficiently privileged actor can never resolve a cached response.
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);
    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }
    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
      throw new InsufficientRoleError();
    }

    // The idempotency key is scoped to the actor so a key issued by one member
    // can never resolve another member's confirmed publish response.
    return this.publishOperation.execute({
      scopedKey: `event-publish:${command.organizationId}:${command.eventId}:${command.actorId}:${command.idempotencyKey}`,
      requestHash: hashRequest(command),
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      organizationId: command.organizationId,
      eventId: command.eventId,
      actorId: command.actorId,
      expectedVersion: command.expectedVersion,
      now: new Date(),
    });
  }
}
