import { RecentCheckIn } from '@/shared/api/attendance.api';

interface RecentCheckInsProps {
  items: RecentCheckIn[];
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RecentCheckIns({ items }: RecentCheckInsProps) {
  return (
    <section aria-label="Check-ins recentes" className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Últimos check-ins</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="no-checkins">
          Nenhum check-in registrado
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Horário</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Operador</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ci, index) => (
                <tr key={index} className="border-t">
                  <td className="px-4 py-2 font-mono">{formatTime(ci.checkedInAt)}</td>
                  <td className="px-4 py-2">{ci.ticketTypeName}</td>
                  <td className="px-4 py-2 font-mono text-muted-foreground">
                    {ci.performedByUserId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
