'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/primitives/button';
import { toMinorUnits } from '@/shared/lib/money';
import { cn } from '@/shared/lib/utils';
import { ApiError } from '../api/ticket-types.api';
import { useCreateTicketType } from '../hooks/use-create-ticket-type';
import { createTicketTypeSchema, type CreateTicketTypeFormData } from '../schemas';
import type { TicketType } from '../types';
import {
  completeIdempotencyOperation,
  createEmptyIdempotencyOperation,
  resolveIdempotencyOperation,
} from '../lib/idempotency-operation';

interface CreateTicketTypeFormProps {
  organizationId: string;
  eventId: string;
  devUserId: string;
  onSuccess: (ticketType: TicketType) => void;
  onCancel: () => void;
}

export function CreateTicketTypeForm({
  organizationId,
  eventId,
  devUserId,
  onSuccess,
  onCancel,
}: CreateTicketTypeFormProps) {
  const operationRef = useRef(createEmptyIdempotencyOperation());
  const mutation = useCreateTicketType(organizationId, eventId, devUserId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketTypeFormData>({
    resolver: zodResolver(createTicketTypeSchema),
    defaultValues: { priceAmount: 0, capacity: 100 },
  });

  async function onSubmit(data: CreateTicketTypeFormData) {
    const input = {
      name: data.name,
      priceAmount: toMinorUnits(data.priceAmount),
      capacity: data.capacity,
      description: data.description ?? null,
    };
    const operation = resolveIdempotencyOperation(
      operationRef.current,
      input,
      () => crypto.randomUUID(),
    );
    operationRef.current = operation.state;

    try {
      const ticketType = await mutation.mutateAsync({
        input,
        idempotencyKey: operation.key,
      });
      operationRef.current = completeIdempotencyOperation();
      onSuccess(ticketType);
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

  const isCurrencyError =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 422 &&
    typeof mutation.error.body === 'object' &&
    mutation.error.body !== null &&
    'detail' in mutation.error.body &&
    String((mutation.error.body as { detail: unknown }).detail).includes('currency');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="tt-name" className="text-sm font-medium">
          Nome do ingresso
        </label>
        <input
          id="tt-name"
          type="text"
          placeholder="Ex: Inteira, Meia-entrada, VIP"
          {...register('name')}
          className={inputClass(!!errors.name)}
        />
        {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tt-description" className="text-sm font-medium">
          Descrição <span className="text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="tt-description"
          rows={2}
          {...register('description')}
          className={cn(inputClass(!!errors.description), 'resize-none')}
        />
        {errors.description && (
          <span className="text-xs text-destructive">{errors.description.message}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="tt-price" className="text-sm font-medium">
            Preço (R$)
          </label>
          <input
            id="tt-price"
            type="number"
            step="0.01"
            min="0"
            {...register('priceAmount', { valueAsNumber: true })}
            className={inputClass(!!errors.priceAmount)}
          />
          {errors.priceAmount && (
            <span className="text-xs text-destructive">{errors.priceAmount.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tt-capacity" className="text-sm font-medium">
            Capacidade
          </label>
          <input
            id="tt-capacity"
            type="number"
            min="1"
            {...register('capacity', { valueAsNumber: true })}
            className={inputClass(!!errors.capacity)}
          />
          {errors.capacity && (
            <span className="text-xs text-destructive">{errors.capacity.message}</span>
          )}
        </div>
      </div>

      {isCurrencyError && (
        <p className="text-sm text-destructive">
          O evento precisa ter uma moeda configurada antes de criar ingressos.
        </p>
      )}

      {mutation.isError && !isCurrencyError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro ao criar ingresso'}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? 'Criando...' : 'Criar ingresso'}
        </Button>
      </div>
    </form>
  );
}
