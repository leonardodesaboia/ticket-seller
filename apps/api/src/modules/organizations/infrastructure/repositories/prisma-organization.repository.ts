import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { Organization } from '../../domain/organization.entity';
import { SlugAlreadyInUseError } from '../../domain/organization.errors';
import type {
  CreateOrganizationInput,
  IOrganizationRepository,
} from '../../domain/ports/organization-repository.port';

@Injectable()
export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrganizationInput): Promise<Organization> {
    try {
      const [org] = await this.prisma.$transaction([
        this.prisma.organization.create({
          data: {
            id: input.id,
            name: input.name,
            slug: input.slug,
            ownerId: input.ownerId,
            status: 'ACTIVE',
          },
        }),
        this.prisma.organizationMember.create({
          data: {
            organizationId: input.id,
            userId: input.ownerId,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        }),
        this.prisma.outboxEvent.create({
          data: {
            aggregateType: 'organization',
            aggregateId: input.id,
            type: 'organization.created.v1',
            version: '1',
            organizationId: input.id,
            payload: {
              organizationId: input.id,
              name: input.name,
              slug: input.slug,
              ownerId: input.ownerId,
            },
          },
        }),
      ]);

      return new Organization(org.id, org.name, org.slug, org.status, org.ownerId, org.createdAt);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new SlugAlreadyInUseError(input.slug);
      }
      throw err;
    }
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.prisma.organization.count({ where: { slug } });
    return count > 0;
  }
}
