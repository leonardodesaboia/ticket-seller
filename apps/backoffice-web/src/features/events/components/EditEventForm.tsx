'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/lib/utils';
import { ApiError } from '../api/events.api';
import { useUpdateEvent } from '../hooks/use-update-event';
import { updateEventSchema, type UpdateEventFormData } from '../schemas';
import type { Event } from '../types';

interface EditEventFormProps {
  event: Event;
  organizationId: string;
  onSuccess: (updated: Event) => void;
}

export function EditEventForm({ event, organizationId, onSuccess }: EditEventFormProps) {
  const mutation = useUpdateEvent(organizationId, event.id);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEventFormData>({
    resolver: zodResolver(updateEventSchema),
    defaultValues: {
      title: event.title,
      description: event.description ?? undefined,
      version: event.version,
    },
  });

  useEffect(() => {
    setValue('version', event.version);
  }, [event.version, setValue]);

  async function onSubmit(data: UpdateEventFormData) {
    try {
      const updated = await mutation.mutateAsync({
        title: data.title,
        description: data.description ?? null,
        version: data.version,
      });
      onSuccess(updated);
    } catch {
      // error handled via mutation.error
    }
  }

  const isConflict =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 409;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register('version', { valueAsNumber: true })} />

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-foreground">
          Título
        </label>
        <input
          id="title"
          type="text"
          placeholder="Nome do evento"
          {...register('title')}
          className={cn(
            'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            errors.title && 'border-destructive',
          )}
        />
        {errors.title && <span className="text-xs text-destructive">{errors.title.message}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Descrição <span className="text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="description"
          rows={4}
          placeholder="Descreva o evento..."
          {...register('description')}
          className={cn(
            'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            'resize-none',
            errors.description && 'border-destructive',
          )}
        />
        {errors.description && (
          <span className="text-xs text-destructive">{errors.description.message}</span>
        )}
      </div>

      {isConflict && (
        <p className="text-sm text-destructive">
          Este evento foi modificado por outra ação. Recarregue a página e tente novamente.
        </p>
      )}

      {mutation.isError && !isConflict && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro desconhecido'}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
