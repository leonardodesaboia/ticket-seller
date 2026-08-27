import { randomUUID } from 'crypto';
import type { Organization } from '../../domain/organization.entity';
import { SlugAlreadyInUseError } from '../../domain/organization.errors';
import type { IOrganizationRepository } from '../../domain/ports/organization-repository.port';
import { ValidationError } from '../../../../shared/kernel/application-errors';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CreateOrganizationCommand {
  name: string;
  slug: string;
  actorId: string;
}

export class CreateOrganizationUseCase {
  constructor(
    private readonly repository: IOrganizationRepository,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<Organization> {
    if (!SLUG_PATTERN.test(command.slug)) {
      throw new ValidationError(
        'Slug must contain only lowercase letters, numbers, and hyphens',
      );
    }

    const slugTaken = await this.repository.existsBySlug(command.slug);
    if (slugTaken) {
      throw new SlugAlreadyInUseError(command.slug);
    }

    return this.repository.create({
      id: randomUUID(),
      name: command.name,
      slug: command.slug,
      ownerId: command.actorId,
    });
  }
}
