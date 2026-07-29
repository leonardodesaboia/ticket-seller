import Link from 'next/link';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-24">
      <h1 className="text-4xl font-bold text-foreground">Backoffice</h1>
      <p className="text-lg text-muted-foreground">Painel administrativo do Ticket Seller</p>
      <Link
        href="/organizations/new"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Nova organização
      </Link>
    </main>
  );
}
