import { z } from 'zod';

export const createTicketTypeSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(500, 'Nome deve ter no máximo 500 caracteres'),
  description: z
    .string()
    .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
    .nullable()
    .optional(),
  priceAmount: z
    .number({ invalid_type_error: 'Preço deve ser um número' })
    .min(0, 'Preço não pode ser negativo'),
  capacity: z
    .number({ invalid_type_error: 'Capacidade deve ser um número' })
    .int('Capacidade deve ser inteiro')
    .min(1, 'Capacidade deve ser pelo menos 1'),
});

export type CreateTicketTypeFormData = z.infer<typeof createTicketTypeSchema>;

export const updateTicketTypeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(500, 'Nome deve ter no máximo 500 caracteres')
    .optional(),
  description: z
    .string()
    .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
    .nullable()
    .optional(),
  priceAmount: z
    .number({ invalid_type_error: 'Preço deve ser um número' })
    .min(0, 'Preço não pode ser negativo')
    .optional(),
  capacity: z
    .number({ invalid_type_error: 'Capacidade deve ser um número' })
    .int('Capacidade deve ser inteiro')
    .min(1, 'Capacidade deve ser pelo menos 1')
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type UpdateTicketTypeFormData = z.infer<typeof updateTicketTypeSchema>;
