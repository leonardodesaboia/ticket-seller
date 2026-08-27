'use client';

import { useState } from 'react';
import { useAdminOrganizations } from '../hooks/useAdminOrganizations';
import { useAuth } from '@/features/auth';
import { useQueryClient } from '@tanstack/react-query';
import { suspendOrganization, unsuspendOrganization } from '../api/admin.api';

interface ReasonDialog {
  type: 'suspend' | 'unsuspend';
  orgId: string;
  orgName: string;
}

export function OrganizationsAdminTable() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ReasonDialog | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const orgQuery: { cursor?: string; limit?: number } = { limit: 50 };
  if (cursor !== undefined) orgQuery.cursor = cursor;
  const { data, isLoading, error } = useAdminOrganizations(orgQuery);

  function openSuspend(orgId: string, orgName: string) {
    setReasonInput('');
    setDialog({ type: 'suspend', orgId, orgName });
  }

  function openUnsuspend(orgId: string, orgName: string) {
    setReasonInput('');
    setDialog({ type: 'unsuspend', orgId, orgName });
  }

  async function handleConfirm() {
    if (!dialog || !reasonInput.trim()) return;
    setSubmitting(true);
    try {
      if (dialog.type === 'suspend') {
        await suspendOrganization(dialog.orgId, reasonInput.trim(), token ?? '');
      } else {
        await unsuspendOrganization(dialog.orgId, reasonInput.trim(), token ?? '');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      setActionError(null);
      setDialog(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao executar ação');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando organizações...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Erro ao carregar organizações.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dialog.type === 'suspend' ? 'Suspender organização' : 'Reativar organização'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-input bg-background p-6 shadow-lg">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              {dialog.type === 'suspend' ? 'Suspender organização' : 'Reativar organização'}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">{dialog.orgName}</p>
            <label htmlFor="org-reason" className="mb-1 block text-sm font-medium text-foreground">
              Motivo *
            </label>
            <input
              id="org-reason"
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="mb-4 w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Informe o motivo..."
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded border border-input px-4 py-1.5 text-sm hover:bg-muted"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting || !reasonInput.trim()}
                className="rounded bg-destructive px-4 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? 'Aguarde...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-input">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Membros</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Eventos</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Criada em</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((org) => (
              <tr key={org.id} className="border-b border-input last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2 font-medium">{org.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{org.memberCount}</td>
                <td className="px-4 py-2 text-muted-foreground">{org.eventCount}</td>
                <td className="px-4 py-2">
                  {org.suspendedAt ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Suspensa
                    </span>
                  ) : (
                    <span className="rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success">
                      Ativa
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-2">
                  {org.suspendedAt ? (
                    <button
                      onClick={() => openUnsuspend(org.id, org.name)}
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      onClick={() => openSuspend(org.id, org.name)}
                      className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
                    >
                      Suspender
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        {cursor && (
          <button
            onClick={() => setCursor(undefined)}
            className="rounded border border-input px-3 py-1 text-sm hover:bg-muted"
          >
            Início
          </button>
        )}
        {data.nextCursor && (
          <button
            onClick={() => setCursor(data.nextCursor ?? undefined)}
            className="rounded border border-input px-3 py-1 text-sm hover:bg-muted"
          >
            Próxima página
          </button>
        )}
      </div>
    </div>
  );
}
