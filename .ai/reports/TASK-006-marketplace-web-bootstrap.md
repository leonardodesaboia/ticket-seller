Relatório da TASK-006 — Marketplace Web Bootstrap (Next.js 15)

Status

COMPLETED

Arquivos alterados

apps/marketplace-web/package.json: criado
apps/marketplace-web/tsconfig.json: criado — extends @ticket-seller/tsconfig/nextjs.json; excluídos jest.config.ts e jest.setup.ts da compilação
apps/marketplace-web/next.config.ts: criado
apps/marketplace-web/postcss.config.mjs: criado — @tailwindcss/postcss
apps/marketplace-web/.env.example: criado
apps/marketplace-web/jest.config.ts: criado — next/jest + jsdom + setupFilesAfterEnv
apps/marketplace-web/jest.setup.ts: criado — importa @testing-library/jest-dom
apps/marketplace-web/components.json: criado — shadcn/ui config (Tailwind 4, CSS variables, neutral)
apps/marketplace-web/src/app/globals.css: criado — @import "tailwindcss" + CSS variables
apps/marketplace-web/src/app/layout.tsx: criado — html lang="pt-BR", Metadata
apps/marketplace-web/src/app/page.tsx: criado — homepage mínima
apps/marketplace-web/src/app/page.test.tsx: criado — 2 testes com @testing-library/react
apps/marketplace-web/src/app/loading.tsx: criado — spinner acessível
apps/marketplace-web/src/app/error.tsx: criado — 'use client', ErrorBoundary com botão retry
apps/marketplace-web/src/app/not-found.tsx: criado — 404 com link para /
apps/marketplace-web/src/lib/api-client.ts: criado — stub apiFetch<T>
apps/marketplace-web/src/lib/utils.ts: criado — função cn() (clsx + tailwind-merge)
apps/marketplace-web/src/components/ui/button.tsx: criado — Button component (shadcn/ui style)

Implementado

Next.js 15 App Router com TypeScript
Tailwind CSS 4 via @tailwindcss/postcss (configuração via CSS, sem tailwind.config.ts)
shadcn/ui: componentes configurados manualmente (components.json, Button, utils.ts)
CSS variables para temas claro/escuro
lang="pt-BR" no layout raiz
Elementos semânticos: main, h1, p, button, a
Loading, error e not-found states
Stub de API client (apiFetch<T>)
Jest + @testing-library/react

Testes executados

Comando	Resultado
tsc --noEmit	PASS
next lint	PASS — No ESLint warnings or errors
next build	PASS — build estático com sucesso, 4 páginas geradas
jest (2 testes)	PASS — 2/2 tests passed

Dependências instaladas

next ^15.0.0, react ^19.0.0, react-dom ^19.0.0
@radix-ui/react-slot ^1.1.0, class-variance-authority ^0.7.1
clsx ^2.1.1, tailwind-merge ^2.5.2, lucide-react ^0.441.0
zod ^3.23.8
@tailwindcss/postcss ^4.0.0, postcss ^8.4.47
jest ^29.7.0, jest-environment-jsdom ^29.7.0, ts-jest, ts-node
@testing-library/react ^16.0.1, @testing-library/jest-dom ^6.5.0

Nota: sharp (otimização nativa de imagens do Next.js) teve build script sinalizado como ERR_PNPM_IGNORED_BUILDS. Funciona em desenvolvimento; apenas imagem optimization com srcset nativo fica indisponível (irrelevante no bootstrap).

Riscos

sharp: pnpm 11 sinaliza como ERR_PNPM_IGNORED_BUILDS — adicionar ao pnpm.approvedBuilds no package.json raiz durante a integração.
next lint está deprecated no Next.js 15.5 (será removido no Next.js 16) — migrar para ESLint CLI em tarefa futura.

Pendências

Nenhuma para o escopo do bootstrap.

Commit recomendado

feat(marketplace-web): bootstrap Next.js app with Tailwind and shadcn/ui [TASK-006]
