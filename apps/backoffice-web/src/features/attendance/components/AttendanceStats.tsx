import { AttendanceResponse } from '@/shared/api/attendance.api';

interface AttendanceStatsProps {
  data: AttendanceResponse | null;
}

export function AttendanceStats({ data }: AttendanceStatsProps) {
  const totalIssued = data?.totalIssued ?? 0;
  const totalAdmitted = data?.totalAdmitted ?? 0;
  const totalRemaining = data?.totalRemaining ?? 0;
  const attendanceRate = data?.attendanceRate ?? 0;

  return (
    <section aria-label="Métricas de presença">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">Emitidos</p>
          <p className="text-2xl font-bold" data-testid="total-issued">{totalIssued}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">Admitidos</p>
          <p className="text-2xl font-bold" data-testid="total-admitted">{totalAdmitted}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">Restantes</p>
          <p className="text-2xl font-bold" data-testid="total-remaining">{totalRemaining}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">Taxa de presença</p>
          <p className="text-2xl font-bold" data-testid="attendance-rate">
            {attendanceRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {data && data.byTicketType.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Por tipo de ingresso</h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Emitidos</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Admitidos</th>
                </tr>
              </thead>
              <tbody>
                {data.byTicketType.map((t) => (
                  <tr key={t.ticketTypeId} className="border-t">
                    <td className="px-4 py-2">{t.ticketTypeName}</td>
                    <td className="px-4 py-2 text-right">{t.totalIssued}</td>
                    <td className="px-4 py-2 text-right">{t.totalAdmitted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
