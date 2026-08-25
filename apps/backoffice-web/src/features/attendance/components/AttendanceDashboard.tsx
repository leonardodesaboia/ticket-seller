'use client';

import { useAttendancePolling } from '../hooks/useAttendancePolling';
import { AttendanceStats } from './AttendanceStats';
import { RecentCheckIns } from './RecentCheckIns';

interface AttendanceDashboardProps {
  orgId: string;
  eventId: string;
}

export function AttendanceDashboard({ orgId, eventId }: AttendanceDashboardProps) {
  const { data, error } = useAttendancePolling(orgId, eventId);

  return (
    <main className="mx-auto max-w-4xl p-4">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Dashboard de Presença</h1>
        <p className="text-sm text-muted-foreground">
          Atualizado automaticamente a cada 15 segundos
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          Erro ao carregar dados de presença. Tente novamente em instantes.
        </div>
      )}

      {!data && !error && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Carregando...
        </p>
      )}

      <section>
        <AttendanceStats data={data} />
        <RecentCheckIns items={data?.recentCheckIns ?? []} />
      </section>
    </main>
  );
}
