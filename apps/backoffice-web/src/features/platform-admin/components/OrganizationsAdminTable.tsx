'use client';

import { useState } from 'react';
import { useAdminOrganizations } from '../hooks/useAdminOrganizations';
import { useQueryClient } from '@tanstack/react-query';
import { suspendOrganization, unsuspendOrganization } from '../api/admin.api';

interface OrganizationsAdminTableProps {
  devUserId?: string | undefined;
}

export function OrganizationsAdminTable({ devUserId }: OrganizationsAdminTableProps) {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const orgQuery: { cursor?: string; limit?: number } = { limit: 50 };
  if (cursor !== undefined) orgQuery.cursor = cursor;
  const { data, isLoading, error } = useAdminOrganizations(orgQuery, devUserId);

  async function handleSuspend(orgId: string) {
    const reason = window.prompt('Motivo da suspensão:');
    if (!reason) return;
    try {
      await suspendOrganization(orgId, reason, devUserId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao suspender');
    }
  }

  async function handleUnsuspend(orgId: string) {
    const reason = window.prompt('Motivo da reativação:');
    if (!reason) return;
    try {
      await unsuspendOrganization(orgId, reason, devUserId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao reativar');
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
      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
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
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
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
                      onClick={() => void handleUnsuspend(org.id)}
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleSuspend(org.id)}
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
