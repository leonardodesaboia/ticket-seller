TASK-006 — Marketplace Web Bootstrap

Status

READY

Responsável

Não atribuído.

Objetivo

Criar a aplicação web pública inicial em apps/marketplace-web/ usando Next.js 15 com App Router, Tailwind CSS 4 e shadcn/ui. Sem catálogo, eventos, checkout, autenticação ou regras de negócio.

Resultado observável

pnpm dev inicia o servidor em localhost:3001
Página inicial renderiza sem erro
Layout base presente
Loading e error states configurados
pnpm build passa sem erros de TypeScript
pnpm typecheck passa
pnpm lint passa
pnpm test passa
Acessibilidade mínima: lang no <html>, sem uso de div onde semântica se aplica

Coordenação

Branch

feature/TASK-006-marketplace-web-bootstrap

Worktree

../ticket-seller-task-006

Dependências obrigatórias

TASK-003 (MERGED)

Pode executar em paralelo com

TASK-004
TASK-005

Não pode executar em paralelo com

Nenhuma outra tarefa em apps/marketplace-web/**

Propriedade exclusiva

apps/marketplace-web/**

Arquivos compartilhados bloqueados

Não alterar:
package.json (raiz)
pnpm-lock.yaml
turbo.json
pnpm-workspace.yaml
packages/tsconfig/** (já criados pelo orquestrador)
AGENTS.md
CLAUDE.md

Contratos consumidos

packages/tsconfig/nextjs.json (leitura)

Contratos produzidos

Nenhum contrato de API. Stub de cliente da API documentado em src/lib/api-client.ts.

Contexto obrigatório

Leia somente:

AGENTS.md
esta tarefa

Arquivos permitidos

apps/marketplace-web/** (todos os arquivos dentro deste diretório)

Arquivos proibidos

Qualquer arquivo fora de apps/marketplace-web/
package.json da raiz
pnpm-lock.yaml
turbo.json
pnpm-workspace.yaml
packages/**
infra/**
compose.yaml
apps/api/**
docs/**
.ai/**

Requisitos

1. Criar apps/marketplace-web/package.json com nome @ticket-seller/marketplace-web e scripts
   - "dev": "next dev --port 3001"
   - "build": "next build"
   - "start": "next start --port 3001"
   - "lint": "next lint"
   - "typecheck": "tsc --noEmit"
   - "test": "jest"

2. Criar apps/marketplace-web/tsconfig.json estendendo @ticket-seller/tsconfig/nextjs.json

3. Criar apps/marketplace-web/next.config.ts

4. Instalar e configurar Tailwind CSS 4:
   - Usar @tailwindcss/postcss como plugin PostCSS
   - Configurar via CSS (não tailwind.config.ts)
   - Adicionar @import "tailwindcss" no globals.css

5. Instalar shadcn/ui via CLI: npx shadcn@latest init
   - Responder: TypeScript: yes, style: default, base color: neutral, global CSS: src/app/globals.css, CSS variables: yes, tailwind config: (Tailwind 4 — sem arquivo de config)
   - Adicionar pelo menos um componente: Button

6. Criar estrutura App Router em src/app/:
   - layout.tsx (root layout com html lang="pt-BR", body, ThemeProvider se aplicável)
   - page.tsx (homepage mínima — heading, parágrafo)
   - loading.tsx (skeleton ou spinner)
   - error.tsx ('use client', ErrorBoundary)
   - not-found.tsx (página 404)
   - globals.css (Tailwind 4 + shadcn tokens)

7. Criar src/lib/api-client.ts como stub:
   - Exportar constante API_BASE_URL lida do env
   - Exportar função apiFetch<T> genérica (não faz chamadas reais ainda)
   - Documentar que será substituída por cliente gerado da OpenAPI

8. Criar apps/marketplace-web/.env.example:
   NEXT_PUBLIC_API_URL=http://localhost:3000

9. Criar apps/marketplace-web/jest.config.ts com jest-environment-jsdom
   Adicionar devDependency: jest, jest-environment-jsdom, @testing-library/react, @testing-library/jest-dom

10. Criar apps/marketplace-web/src/app/page.test.tsx com teste mínimo de renderização

Dependências a instalar em apps/marketplace-web/package.json

Runtime (dependencies):
next
react
react-dom
zod

Dev (devDependencies):
@types/node
@types/react
@types/react-dom
typescript (5.9.3)
@tailwindcss/postcss
postcss
jest
jest-environment-jsdom
@testing-library/react
@testing-library/jest-dom
@types/jest

shadcn/ui instala suas próprias dependências via CLI.

Após criar apps/marketplace-web/package.json, executar pnpm install na raiz do worktree.
Isso atualizará o pnpm-lock.yaml DO WORKTREE (não o canonical — o integrador resolverá no merge).

Estrutura esperada

apps/marketplace-web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── page.test.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── ui/ (gerado pelo shadcn/ui)
│   └── lib/
│       ├── api-client.ts
│       └── utils.ts (gerado pelo shadcn/ui)
├── public/
├── .env.example
├── jest.config.ts
├── next.config.ts
├── postcss.config.mjs
├── package.json
└── tsconfig.json

Tailwind CSS 4 — configuração via CSS (não via arquivo JS)

Em globals.css:
@import "tailwindcss";
(sem necessidade de tailwind.config.ts para configuração básica)

Para shadcn/ui com Tailwind 4, seguir documentação atual do shadcn.

Acessibilidade mínima obrigatória

<html lang="pt-BR"> no layout.tsx
Usar elementos semânticos (header, main, footer, nav, h1)
Não usar div onde button, a, p se aplicam
Imagens com alt (mesmo que vazio para decorativas)

Invariantes

Nenhuma regra de negócio implementada.
Nenhuma chamada real à API (apenas stub).
Nenhum estado de autenticação.
Nenhuma lógica de estoque ou pagamento.

Segurança

Não incluir secrets em código-fonte.
NEXT_PUBLIC_API_URL deve vir do .env.example.
Não renderizar HTML não sanitizado diretamente no DOM. Toda inserção de conteúdo deve usar JSX padrão do React.

Multi-tenancy

Não aplicável nesta tarefa.

Concorrência

Não aplicável nesta tarefa.

Idempotência

Não aplicável nesta tarefa.

Fora do escopo

Catálogo de eventos
Checkout
Autenticação (NextAuth, Clerk, etc.)
TanStack Query (ainda sem chamadas reais)
React Hook Form
Páginas de evento específico
Backoffice
PWA de check-in
Analytics
Internacionalização

Critérios de aceite

propriedade respeitada (apenas apps/marketplace-web/**);
nenhum arquivo global alterado;
pnpm dev inicia em :3001 sem erro;
pnpm build passa;
pnpm lint passa;
pnpm typecheck passa;
pnpm test passa;
layout.tsx tem lang="pt-BR";
relatório criado em .ai/reports/TASK-006-marketplace-web-bootstrap.md;
commit realizado na branch feature/TASK-006-marketplace-web-bootstrap.

Comandos de validação

pnpm --filter @ticket-seller/marketplace-web typecheck
pnpm --filter @ticket-seller/marketplace-web lint
pnpm --filter @ticket-seller/marketplace-web test
pnpm --filter @ticket-seller/marketplace-web build
git diff --check
git diff --stat
git diff --name-status

Formato de conclusão

Arquivos alterados
Implementado
Testes executados
Dependências instaladas
Riscos
Pendências
Commit

Commit recomendado

feat(marketplace-web): bootstrap Next.js app with Tailwind and shadcn/ui [TASK-006]
