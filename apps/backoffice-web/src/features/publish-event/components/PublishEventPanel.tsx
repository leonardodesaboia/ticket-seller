'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PublicationChecklist,
  usePublicationReadiness,
} from '@/features/publication-readiness';
import { usePublishEvent } from '../hooks/use-publish-event';
import { PublishError } from '../api/publish.api';
import {
  completeIdempotencyOperation,
  createEmptyIdempotencyOperation,
  resolveIdempotencyOperation,
  type IdempotencyOperationState,
} from '../lib/idempotency';

interface PublishEventPanelProps {
  organizationId: string;
  eventId: string;
  version: number;
  devUserId: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof PublishError) {
    if (error.status === 409) {
      return `${error.message} Atualize a página e tente novamente.`;
    }
    if (error.status === 422) {
      return 'O evento não está pronto para publicação. Revise as pendências acima.';
    }
    return error.message;
  }
  return 'Não foi possível publicar o evento. Verifique sua conexão e tente novamente.';
}

export function PublishEventPanel({
  organizationId,
  eventId,
  version,
  devUserId,
}: PublishEventPanelProps) {
  const readinessQuery = usePublicationReadiness(organizationId, eventId, devUserId);
  const mutation = usePublishEvent(organizationId, eventId, devUserId);
  const operationRef = useRef<IdempotencyOperationState>(createEmptyIdempotencyOperation());
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (mutation.isError) errorRef.current?.focus();
  }, [mutation.isError]);

  const readiness = readinessQuery.data;
  const canPublish = Boolean(readiness?.ready) && !mutation.isPending;

  function handlePublish() {
    const payload = { version };
    const operation = resolveIdempotencyOperation(
      operationRef.current,
      payload,
      () => crypto.randomUUID(),
    );
    operationRef.current = operation.state;

    mutation.mutate(
      { version, idempotencyKey: operation.key },
      {
        onSuccess: () => {
          operationRef.current = completeIdempotencyOperation();
          setConfirming(false);
        },
      },
    );
  }

  return (
    <section aria-labelledby="publish-heading" className="mt-8 flex flex-col gap-4">
      <h2 id="publish-heading" className="text-lg font-semibold text-foreground">
        Publicação
      </h2>

      {readinessQuery.isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Carregando checklist...
        </p>
      )}

      {readinessQuery.error && (
        <p className="text-sm text-destructive" role="alert">
          {readinessQuery.error instanceof Error
            ? readinessQuery.error.message
            : 'Erro ao carregar o checklist.'}
        </p>
      )}

      {readiness && (
        <PublicationChecklist
          readiness={readiness}
          organizationId={organizationId}
          eventId={eventId}
        />
      )}

      {mutation.isError && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {errorMessage(mutation.error)}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-input p-3">
          <p className="text-sm text-foreground">
            Publicar este evento torna-o público e bloqueia novas edições. Confirmar?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {mutation.isPending ? 'Publicando...' : 'Confirmar publicação'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={mutation.isPending}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canPublish}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            Publicar evento
          </button>
          {readiness && !readiness.ready && (
            <p className="mt-2 text-sm text-muted-foreground">
              Resolva as pendências acima para habilitar a publicação.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
