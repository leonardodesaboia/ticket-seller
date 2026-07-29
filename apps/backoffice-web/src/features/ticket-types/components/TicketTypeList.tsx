'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/primitives/button';
import { toDisplayValue } from '@/shared/lib/money';
import { ApiError } from '../api/ticket-types.api';
import { useListTicketTypes } from '../hooks/use-list-ticket-types';
import { useUpdateTicketType } from '../hooks/use-update-ticket-type';
import type { TicketType } from '../types';
import { CreateTicketTypeForm } from './CreateTicketTypeForm';

interface TicketTypeListProps {
  organizationId: string;
  eventId: string;
  eventCurrency: string | null;
  devUserId: string;
}

export function TicketTypeList({
  organizationId,
  eventId,
  eventCurrency,
  devUserId,
}: TicketTypeListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: ticketTypes = [], isLoading, error } = useListTicketTypes(
    organizationId,
    eventId,
    devUserId,
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando ingressos...</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Erro ao carregar ingressos'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {ticketTypes.length === 0 && !showCreateForm && (
        <p className="text-sm text-muted-foreground">Nenhum tipo de ingresso cadastrado.</p>
      )}

      {ticketTypes.map((tt) => (
        <TicketTypeRow
          key={tt.id}
          ticketType={tt}
          currency={eventCurrency}
          organizationId={organizationId}
          eventId={eventId}
          devUserId={devUserId}
        />
      ))}

      {showCreateForm ? (
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium">Novo tipo de ingresso</p>
          <CreateTicketTypeForm
            organizationId={organizationId}
            eventId={eventId}
            devUserId={devUserId}
            onSuccess={() => setShowCreateForm(false)}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setShowCreateForm(true)}
          disabled={!eventCurrency}
        >
          + Adicionar ingresso
          {!eventCurrency && (
            <span className="ml-1 text-xs text-muted-foreground">(configure a moeda primeiro)</span>
          )}
        </Button>
      )}
    </div>
  );
}

interface TicketTypeRowProps {
  ticketType: TicketType;
  currency: string | null;
  organizationId: string;
  eventId: string;
  devUserId: string;
}

function TicketTypeRow({
  ticketType,
  currency,
  organizationId,
  eventId,
  devUserId,
}: TicketTypeRowProps) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useUpdateTicketType(
    organizationId,
    eventId,
    ticketType.id,
    devUserId,
  );

  const isActive = ticketType.status === 'ACTIVE';
  const priceDisplay = currency
    ? toDisplayValue(ticketType.priceAmount, currency)
    : `${ticketType.priceAmount} centavos`;

  async function handleDeactivate() {
    try {
      await mutation.mutateAsync({
        expectedVersion: ticketType.version,
        status: 'INACTIVE',
      });
    } catch {
      // error shown below
    } finally {
      setConfirming(false);
    }
  }

  const isConflict =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 409;

  return (
    <div className="flex items-start justify-between rounded-md border border-border p-3 gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">
          {ticketType.name}
          {!isActive && (
            <span className="ml-2 text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded">
              Inativo
            </span>
          )}
        </span>
        {ticketType.description && (
          <span className="text-xs text-muted-foreground">{ticketType.description}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {priceDisplay} · Capacidade: {ticketType.capacity}
        </span>
        {isConflict && (
          <span className="text-xs text-destructive">
            Conflito de versão — recarregue a página.
          </span>
        )}
        {mutation.isError && !isConflict && (
          <span className="text-xs text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : 'Erro'}
          </span>
        )}
      </div>

      {isActive && (
        <div className="flex gap-2 shrink-0">
          {confirming ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeactivate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Desativando...' : 'Confirmar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Desativar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
