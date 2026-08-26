import { UsersAdminTable } from '@/features/platform-admin';

export const metadata = {
  title: 'Usuários — Administração da Plataforma',
};

export default function AdminUsersPage() {

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <a
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Administração
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Listagem e gerenciamento de todos os usuários da plataforma.
        </p>
      </div>

      <UsersAdminTable />
    </main>
  );
}
