'use client';

import { useAdminDashboard } from '../hooks/useAdminDashboard';


interface StatCardProps {
  label: string;
  value: number;
  highlight?: boolean;
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border p-4 ${
        highlight && value > 0
          ? 'border-destructive bg-destructive/5'
          : 'border-input bg-background'
      }`}
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-2xl font-bold ${
          highlight && value > 0 ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {value.toLocaleString('pt-BR')}
      </span>
    </div>
  );
}

export function AdminDashboardCards() {
  const { data, isLoading, error } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-input bg-background p-4 animate-pulse"
          >
            <span className="h-3 w-24 rounded bg-muted" />
            <span className="h-7 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Erro ao carregar dashboard.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Organizações" value={data.totalOrganizations} />
      <StatCard label="Usuários" value={data.totalUsers} />
      <StatCard label="Eventos" value={data.totalEvents} />
      <StatCard label="Pedidos ativos" value={data.activeOrders} />
      <StatCard label="Payouts pendentes" value={data.pendingPayouts} />
      <StatCard label="Payouts em processo" value={data.processingPayouts} />
      <StatCard label="Org. suspensas" value={data.suspendedOrganizations} highlight />
    </div>
  );
}
