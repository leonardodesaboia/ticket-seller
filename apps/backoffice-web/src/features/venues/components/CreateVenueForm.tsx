'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/lib/utils';
import { useCreateVenue } from '../hooks/use-create-venue';
import { createVenueSchema, type CreateVenueFormData } from '../schemas';
import type { Venue } from '../types';

interface CreateVenueFormProps {
  organizationId: string;
  onSuccess: (venue: Venue) => void;
  onCancel: () => void;
}

export function CreateVenueForm({
  organizationId,
  onSuccess,
  onCancel,
}: CreateVenueFormProps) {
  const mutation = useCreateVenue(organizationId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateVenueFormData>({
    resolver: zodResolver(createVenueSchema),
    defaultValues: { country: 'BR' },
  });

  async function onSubmit(data: CreateVenueFormData) {
    try {
      const venue = await mutation.mutateAsync({
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        ...(data.postalCode ? { postalCode: data.postalCode } : {}),
      });
      onSuccess(venue);
    } catch {
      // error handled via mutation.error
    }
  }

  const inputClass = (hasError: boolean) =>
    cn(
      'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
      'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
      hasError && 'border-destructive',
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="venue-name" className="text-sm font-medium">
          Nome do local
        </label>
        <input
          id="venue-name"
          type="text"
          placeholder="Ex: Teatro Municipal"
          {...register('name')}
          className={inputClass(!!errors.name)}
        />
        {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="venue-address" className="text-sm font-medium">
          Endereço
        </label>
        <input
          id="venue-address"
          type="text"
          placeholder="Rua, número, complemento"
          {...register('address')}
          className={inputClass(!!errors.address)}
        />
        {errors.address && (
          <span className="text-xs text-destructive">{errors.address.message}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="venue-city" className="text-sm font-medium">
            Cidade
          </label>
          <input
            id="venue-city"
            type="text"
            placeholder="São Paulo"
            {...register('city')}
            className={inputClass(!!errors.city)}
          />
          {errors.city && <span className="text-xs text-destructive">{errors.city.message}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="venue-state" className="text-sm font-medium">
            Estado
          </label>
          <input
            id="venue-state"
            type="text"
            placeholder="SP"
            {...register('state')}
            className={inputClass(!!errors.state)}
          />
          {errors.state && (
            <span className="text-xs text-destructive">{errors.state.message}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="venue-country" className="text-sm font-medium">
            País (2 letras)
          </label>
          <input
            id="venue-country"
            type="text"
            placeholder="BR"
            maxLength={2}
            {...register('country')}
            className={inputClass(!!errors.country)}
          />
          {errors.country && (
            <span className="text-xs text-destructive">{errors.country.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="venue-postal" className="text-sm font-medium">
            CEP <span className="text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="venue-postal"
            type="text"
            placeholder="00000-000"
            {...register('postalCode')}
            className={inputClass(!!errors.postalCode)}
          />
          {errors.postalCode && (
            <span className="text-xs text-destructive">{errors.postalCode.message}</span>
          )}
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro ao criar local'}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? 'Criando...' : 'Criar local'}
        </Button>
      </div>
    </form>
  );
}
