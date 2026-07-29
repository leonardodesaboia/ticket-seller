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
