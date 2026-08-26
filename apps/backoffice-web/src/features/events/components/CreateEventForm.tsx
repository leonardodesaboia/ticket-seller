'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/lib/utils';
import { useCreateEvent } from '../hooks/use-create-event';
import { createEventSchema, type CreateEventFormData } from '../schemas';
import type { Event } from '../types';

interface CreateEventFormProps {
  organizationId: string;
  onSuccess: (event: Event) => void;
}

export function CreateEventForm({ organizationId, onSuccess }: CreateEventFormProps) {
  const mutation = useCreateEvent(organizationId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
  });

  async function onSubmit(data: CreateEventFormData) {
    try {
      const event = await mutation.mutateAsync(data);
      onSuccess(event);
    } catch {
      // error handled via mutation.error
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro desconhecido'}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? 'Criando...' : 'Criar evento'}
      </Button>
    </form>
  );
}
