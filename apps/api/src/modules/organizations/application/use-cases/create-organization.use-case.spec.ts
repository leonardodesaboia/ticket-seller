import { BadRequestException } from '@nestjs/common';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { SlugAlreadyInUseError } from '../../domain/organization.errors';
import type { IOrganizationRepository } from '../../domain/ports/organization-repository.port';
import type { Organization } from '../../domain/organization.entity';

const makeOrg = (overrides: Partial<Organization> = {}): Organization => ({
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  status: 'ACTIVE',
  ownerId: 'user-1',
  createdAt: new Date(),
  ...overrides,
});

describe('CreateOrganizationUseCase', () => {
  let useCase: CreateOrganizationUseCase;
  let repository: jest.Mocked<IOrganizationRepository>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      existsBySlug: jest.fn(),
    };
    useCase = new CreateOrganizationUseCase(repository);
  });

  it('creates organization when slug is available', async () => {
    repository.existsBySlug.mockResolvedValue(false);
    repository.create.mockResolvedValue(makeOrg());

    const result = await useCase.execute({ name: 'Acme', slug: 'acme', actorId: 'user-1' });

    expect(repository.existsBySlug).toHaveBeenCalledWith('acme');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme', slug: 'acme', ownerId: 'user-1' }),
    );
    expect(result.slug).toBe('acme');
  });

  it('throws SlugAlreadyInUseError when slug is taken', async () => {
    repository.existsBySlug.mockResolvedValue(true);

    await expect(
      useCase.execute({ name: 'Acme', slug: 'acme', actorId: 'user-1' }),
    ).rejects.toThrow(SlugAlreadyInUseError);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when slug has uppercase letters', async () => {
    await expect(
      useCase.execute({ name: 'Acme', slug: 'ACME', actorId: 'user-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when slug contains spaces', async () => {
    await expect(
      useCase.execute({ name: 'Acme', slug: 'my org', actorId: 'user-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when slug has leading hyphen', async () => {
    await expect(
      useCase.execute({ name: 'Acme', slug: '-acme', actorId: 'user-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts valid slug with hyphens and numbers', async () => {
    repository.existsBySlug.mockResolvedValue(false);
    repository.create.mockResolvedValue(makeOrg({ slug: 'my-org-2024' }));

    const result = await useCase.execute({
      name: 'My Org',
      slug: 'my-org-2024',
      actorId: 'user-1',
    });

    expect(result.slug).toBe('my-org-2024');
  });
});
