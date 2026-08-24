'use client';

import { useState } from 'react';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useQueryClient } from '@tanstack/react-query';
import { suspendUser, unsuspendUser } from '../api/admin.api';

interface UsersAdminTableProps {
  devUserId?: string | undefined;
}

export function UsersAdminTable({ devUserId }: UsersAdminTableProps) {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery: { cursor?: string; limit?: number } = { limit: 50 };
  if (cursor !== undefined) usersQuery.cursor = cursor;
  const { data, isLoading, error } = useAdminUsers(usersQuery, devUserId);

  async function handleSuspend(userId: string) {
    const reason = window.prompt('Motivo da suspensão:');
    if (!reason) return;
    try {
      await suspendUser(userId, reason, devUserId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao suspender usuário');
    }
  }

  async function handleUnsuspend(userId: string) {
    const reason = window.prompt('Motivo da reativação:');
    if (!reason) return;
    try {
      await unsuspendUser(userId, reason, devUserId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao reativar usuário');
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando usuários...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Erro ao carregar usuários.</p>;
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
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Criado em</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((user) => (
              <tr key={user.id} className="border-b border-input last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2 font-mono text-xs">{user.email}</td>
                <td className="px-4 py-2">{user.displayName ?? '—'}</td>
                <td className="px-4 py-2">
                  {user.platformRole ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {user.platformRole}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {user.suspendedAt ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Suspenso
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Ativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-2">
                  {user.suspendedAt ? (
                    <button
                      onClick={() => void handleUnsuspend(user.id)}
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleSuspend(user.id)}
                      className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
                      disabled={user.platformRole === 'PLATFORM_ADMIN'}
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
