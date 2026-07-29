import { createOrganizationSchema } from './index';

describe('createOrganizationSchema', () => {
  it('accepts valid name and slug', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme Events', slug: 'acme-events' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createOrganizationSchema.safeParse({ name: '', slug: 'acme' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase letters', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', slug: 'ACME' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', slug: 'my org' });
    expect(result.success).toBe(false);
  });

  it('accepts slug with hyphens and numbers', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', slug: 'my-org-2024' });
    expect(result.success).toBe(true);
  });

  it('rejects slug with leading hyphen', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', slug: '-acme' });
    expect(result.success).toBe(false);
  });
});
