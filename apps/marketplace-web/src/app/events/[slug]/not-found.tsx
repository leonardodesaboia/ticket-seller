import Link from 'next/link';

export default function EventNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 p-24 text-center">
      <h1 className="text-3xl font-bold text-foreground">Evento não encontrado</h1>
      <p className="text-muted-foreground">
        Este evento não existe ou ainda não está disponível publicamente.
      </p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
