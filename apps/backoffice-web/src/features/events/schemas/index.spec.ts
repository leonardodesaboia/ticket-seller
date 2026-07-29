import { createEventSchema } from './index';

describe('createEventSchema', () => {
  it('accepts valid title', () => {
    const result = createEventSchema.safeParse({ title: 'Meu Evento' });
    expect(result.success).toBe(true);
  });

  it('accepts title with optional description', () => {
    const result = createEventSchema.safeParse({
      title: 'Meu Evento',
      description: 'Uma descrição do evento',
    });
    expect(result.success).toBe(true);
  });

  it('description is optional', () => {
    const result = createEventSchema.safeParse({ title: 'Evento Sem Descrição' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
    }
  });

  it('rejects empty title', () => {
    const result = createEventSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const result = createEventSchema.safeParse({ description: 'Sem título' });
    expect(result.success).toBe(false);
  });
});
