import { createEventSchema, updateEventConfigurationSchema } from './index';

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

describe('updateEventConfigurationSchema', () => {
  const validBase = { expectedVersion: 1 };

  it('preserves online configuration when no online command is supplied', () => {
    const result = updateEventConfigurationSchema.safeParse(validBase);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.onlineInfo).toBeUndefined();
      expect(result.data.clearOnlineInfo).toBeUndefined();
    }
  });

  it('accepts an explicit non-empty replacement', () => {
    const result = updateEventConfigurationSchema.safeParse({
      ...validBase,
      onlineInfo: 'https://private.example/access',
    });

    expect(result.success).toBe(true);
  });

  it('accepts an explicit removal action', () => {
    const result = updateEventConfigurationSchema.safeParse({
      ...validBase,
      clearOnlineInfo: true,
    });

    expect(result.success).toBe(true);
  });

  it('normalizes a blank replacement to omission', () => {
    const result = updateEventConfigurationSchema.safeParse({
      ...validBase,
      onlineInfo: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.onlineInfo).toBeUndefined();
    }
  });

  it.each([
    { onlineInfo: null },
    { onlineInfo: 'https://private.example/access', clearOnlineInfo: true },
  ])('rejects an ambiguous online configuration command: %p', (command) => {
    expect(
      updateEventConfigurationSchema.safeParse({ ...validBase, ...command }).success,
    ).toBe(false);
  });
});
