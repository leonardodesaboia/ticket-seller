import { z } from 'zod';

export const createVenueSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(500, 'Nome deve ter no máximo 500 caracteres'),
  address: z
    .string()
    .min(1, 'Endereço é obrigatório')
    .max(500, 'Endereço deve ter no máximo 500 caracteres'),
  city: z.string().min(1, 'Cidade é obrigatória').max(255, 'Cidade deve ter no máximo 255 caracteres'),
  state: z
    .string()
    .min(1, 'Estado é obrigatório')
    .max(255, 'Estado deve ter no máximo 255 caracteres'),
  country: z
    .string()
    .length(2, 'País deve ter exatamente 2 caracteres (ex: BR)')
    .toUpperCase(),
  postalCode: z
    .string()
    .min(1)
    .max(20, 'CEP deve ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
});

export type CreateVenueFormData = z.infer<typeof createVenueSchema>;
