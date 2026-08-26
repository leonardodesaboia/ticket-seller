import { AdminDashboardCards } from '@/features/platform-admin';

export const metadata = {
  title: 'Administração da Plataforma — Backoffice',
};

export default function AdminDashboardPage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administração da Plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral da plataforma. Apenas administradores têm acesso.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Métricas gerais</h2>
        <AdminDashboardCards />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Navegação</h2>
        <div className="flex gap-3">
          <a
            href="/admin/organizations"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Organizações
          </a>
          <a
            href="/admin/users"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Usuários
          </a>
        </div>
      </section>
    </main>
  );
}
