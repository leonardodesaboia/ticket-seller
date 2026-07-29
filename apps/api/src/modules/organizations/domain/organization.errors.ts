export class SlugAlreadyInUseError extends Error {
  constructor(slug: string) {
    super(`Slug already in use: ${slug}`);
    this.name = 'SlugAlreadyInUseError';
  }
}
