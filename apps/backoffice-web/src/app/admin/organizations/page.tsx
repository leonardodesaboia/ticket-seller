import { OrganizationsAdminTable } from '@/features/platform-admin';

export const metadata = {
  title: 'Organizações — Administração da Plataforma',
};

export default function AdminOrganizationsPage() {
  const devUserId = process.env['DEV_PLATFORM_ADMIN_ID'];

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
        <h1 className="text-2xl font-bold text-foreground">Organizações</h1>
        <p className="text-sm text-muted-foreground">
          Listagem e gerenciamento de todas as organizações da plataforma.
        </p>
      </div>

      <OrganizationsAdminTable devUserId={devUserId} />
    </main>
  );
}
