'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/lib/utils';
import { VenueSelect } from '@/features/venues/components/VenueSelect';
import { ApiError } from '../api/events.api';
import { useUpdateEventConfiguration } from '../hooks/use-update-event-configuration';
import {
  updateEventConfigurationSchema,
  type UpdateEventConfigurationFormData,
} from '../schemas';
import type { Event } from '../types';

interface EventConfigurationFormProps {
  event: Event;
  organizationId: string;
  devUserId: string;
  onSuccess: (updated: Event) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  IN_PERSON: 'Presencial',
  ONLINE: 'Online',
  HYBRID: 'Híbrido',
};

export function EventConfigurationForm({
  event,
  organizationId,
  devUserId,
  onSuccess,
}: EventConfigurationFormProps) {
  const mutation = useUpdateEventConfiguration(organizationId, event.id, devUserId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEventConfigurationFormData>({
    resolver: zodResolver(updateEventConfigurationSchema),
    shouldUnregister: true,
    defaultValues: {
      expectedVersion: event.version,
      format: (event.format as 'IN_PERSON' | 'ONLINE' | 'HYBRID' | undefined) ?? undefined,
      startsAt: event.startsAt ?? '',
      endsAt: event.endsAt ?? '',
      timezone: event.timezone ?? '',
      onlineInfo: undefined,
      clearOnlineInfo: undefined,
      venueId: event.venueId ?? null,
      currency: event.currency ?? '',
    },
  });

  useEffect(() => {
    setValue('expectedVersion', event.version);
  }, [event.version, setValue]);

  const format = watch('format');
  const showVenue = format === 'IN_PERSON' || format === 'HYBRID';
  const showOnlineInfo = format === 'ONLINE' || format === 'HYBRID';

  async function onSubmit(data: UpdateEventConfigurationFormData) {
    try {
      const payload: Parameters<typeof mutation.mutateAsync>[0] = {
        expectedVersion: data.expectedVersion,
      };
      if (data.format !== undefined) payload.format = data.format;
      if (data.startsAt) payload.startsAt = data.startsAt;
      if (data.endsAt) payload.endsAt = data.endsAt;
      if (data.timezone) payload.timezone = data.timezone;
      if (data.onlineInfo !== undefined) payload.onlineInfo = data.onlineInfo;
      if (data.clearOnlineInfo) payload.clearOnlineInfo = true;
      if (data.venueId !== undefined) payload.venueId = data.venueId;
      if (data.currency) payload.currency = data.currency;

      const updated = await mutation.mutateAsync(payload);
      onSuccess(updated);
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

  const isConflict =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 409;
  const isCurrencyLocked =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 422;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register('expectedVersion', { valueAsNumber: true })} />

      {/* Format */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cfg-format" className="text-sm font-medium text-foreground">
          Formato
        </label>
        <select
          id="cfg-format"
          {...register('format')}
          className={inputClass(!!errors.format)}
        >
          <option value="">Selecione um formato</option>
          {Object.entries(FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.format && (
          <span className="text-xs text-destructive">{errors.format.message}</span>
        )}
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="cfg-starts" className="text-sm font-medium text-foreground">
            Início
          </label>
          <input
            id="cfg-starts"
            type="datetime-local"
            {...register('startsAt')}
            className={inputClass(!!errors.startsAt)}
          />
          {errors.startsAt && (
            <span className="text-xs text-destructive">{errors.startsAt.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cfg-ends" className="text-sm font-medium text-foreground">
            Término
          </label>
          <input
            id="cfg-ends"
            type="datetime-local"
            {...register('endsAt')}
            className={inputClass(!!errors.endsAt)}
          />
          {errors.endsAt && (
            <span className="text-xs text-destructive">{errors.endsAt.message}</span>
          )}
        </div>
      </div>

      {/* Timezone */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cfg-timezone" className="text-sm font-medium text-foreground">
          Fuso horário
        </label>
        <input
          id="cfg-timezone"
          type="text"
          placeholder="Ex: America/Sao_Paulo"
          {...register('timezone')}
          className={inputClass(!!errors.timezone)}
        />
        {errors.timezone && (
          <span className="text-xs text-destructive">{errors.timezone.message}</span>
        )}
      </div>

      {/* Currency */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cfg-currency" className="text-sm font-medium text-foreground">
          Moeda{' '}
          {event.currency && (
            <span className="text-xs text-muted-foreground">
              (atual: {event.currency} — bloqueada após criar ingressos ativos)
            </span>
          )}
        </label>
        <input
          id="cfg-currency"
          type="text"
          placeholder="BRL"
          maxLength={3}
          {...register('currency')}
          className={inputClass(!!errors.currency)}
        />
        {errors.currency && (
          <span className="text-xs text-destructive">{errors.currency.message}</span>
        )}
      </div>

      {/* Venue (IN_PERSON / HYBRID) */}
      {showVenue && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Local</label>
          <Controller
            name="venueId"
            control={control}
            render={({ field }) => (
              <VenueSelect
                organizationId={organizationId}
                devUserId={devUserId}
                value={field.value}
                onChange={field.onChange}
                hasError={!!errors.venueId}
              />
            )}
          />
          {errors.venueId && (
            <span className="text-xs text-destructive">{errors.venueId.message}</span>
          )}
        </div>
      )}

      {/* Online access information is private and write-only. */}
      {showOnlineInfo && (
        <div className="flex flex-col gap-1">
          <label htmlFor="cfg-online-info" className="text-sm font-medium text-foreground">
            Substituir link / informações online{' '}
            <span className="text-xs text-muted-foreground">(não exibido publicamente)</span>
          </label>
          <p id="cfg-online-info-help" className="text-xs text-muted-foreground">
            {event.onlineConfigured
              ? 'Já existe uma configuração privada. Deixe em branco para preservá-la.'
              : 'Nenhuma configuração online foi cadastrada.'}
          </p>
          <input
            id="cfg-online-info"
            type="text"
            placeholder="https://..."
            aria-describedby="cfg-online-info-help"
            {...register('onlineInfo')}
            className={inputClass(!!errors.onlineInfo)}
          />
          {errors.onlineInfo && (
            <span className="text-xs text-destructive">{errors.onlineInfo.message}</span>
          )}
          {event.onlineConfigured && (
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <Controller
                name="clearOnlineInfo"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={field.value === true}
                    onChange={(changeEvent) =>
                      field.onChange(changeEvent.target.checked ? true : undefined)
                    }
                  />
                )}
              />
              Remover explicitamente a configuração online existente
            </label>
          )}
        </div>
      )}

      {isConflict && (
        <p className="text-sm text-destructive">
          A configuração foi alterada por outra ação. Recarregue a página e tente novamente.
        </p>
      )}

      {isCurrencyLocked && !isConflict && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : 'Não é possível alterar a moeda após criar ingressos ativos.'}
        </p>
      )}

      {mutation.isError && !isConflict && !isCurrencyLocked && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro desconhecido'}
        </p>
      )}

      {mutation.isSuccess && (
        <p className="text-sm text-green-600">Configuração salva com sucesso.</p>
      )}

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? 'Salvando...' : 'Salvar configuração'}
      </Button>
    </form>
  );
}
