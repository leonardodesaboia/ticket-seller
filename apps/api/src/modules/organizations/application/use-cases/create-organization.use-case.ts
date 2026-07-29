import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Organization } from '../../domain/organization.entity';
import { SlugAlreadyInUseError } from '../../domain/organization.errors';
import {
  ORGANIZATION_REPOSITORY,
  type IOrganizationRepository,
} from '../../domain/ports/organization-repository.port';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CreateOrganizationCommand {
  name: string;
  slug: string;
  actorId: string;
}

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly repository: IOrganizationRepository,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<Organization> {
    if (!SLUG_PATTERN.test(command.slug)) {
      throw new BadRequestException(
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
