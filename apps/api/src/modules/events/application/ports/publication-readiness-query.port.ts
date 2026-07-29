import type { PublicationReadinessSnapshot } from '../../domain/publication/publication-readiness.policy';

export interface IPublicationReadinessQueryPort {
  findSnapshot(
    organizationId: string,
    eventId: string,
  ): Promise<PublicationReadinessSnapshot | null>;
}

export const PUBLICATION_READINESS_QUERY_PORT = Symbol('PUBLICATION_READINESS_QUERY_PORT');
