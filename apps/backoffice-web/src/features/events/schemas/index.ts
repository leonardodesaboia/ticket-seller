import { z } from 'zod';

export const createEventSchema = z.object({
  title: z
    .string()
    .min(1, 'Título é obrigatório')
    .max(500, 'Título deve ter no máximo 500 caracteres'),
  description: z.string().max(10000, 'Descrição deve ter no máximo 10000 caracteres').optional(),
});

export type CreateEventFormData = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z
    .string()
    .min(1, 'Título é obrigatório')
    .max(500, 'Título deve ter no máximo 500 caracteres'),
  description: z
    .string()
    .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
    .nullable()
    .optional(),
  version: z.number().int().positive(),
});

export type UpdateEventFormData = z.infer<typeof updateEventSchema>;

export const updateEventConfigurationSchema = z
  .object({
    format: z.enum(['IN_PERSON', 'ONLINE', 'HYBRID']).optional(),
    startsAt: z.string().datetime({ offset: true }).optional().or(z.literal('')),
    endsAt: z.string().datetime({ offset: true }).optional().or(z.literal('')),
    timezone: z.string().min(1).max(100).optional(),
    onlineInfo: z
      .union([
        z.string().trim().min(1, 'Informe um link ou instrução válida').max(2000),
        z.literal('').transform(() => undefined),
      ])
      .optional(),
    clearOnlineInfo: z.literal(true).optional(),
    venueId: z.string().uuid().nullable().optional(),
    currency: z
      .string()
      .length(3, 'Moeda deve ter 3 caracteres (ex: BRL)')
      .toUpperCase()
      .optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt && data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt);
      }
      return true;
    },
    { message: 'Data de término deve ser após a data de início', path: ['endsAt'] },
  )
  .refine((data) => !(data.onlineInfo && data.clearOnlineInfo), {
    message: 'Substitua ou remova a configuração online, não execute as duas ações',
    path: ['onlineInfo'],
  });

export type UpdateEventConfigurationFormData = z.infer<typeof updateEventConfigurationSchema>;
