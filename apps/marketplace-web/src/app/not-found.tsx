import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Link href="/" className="text-primary underline underline-offset-4 hover:no-underline">
        Voltar ao início
      </Link>
    </main>
  );
}
