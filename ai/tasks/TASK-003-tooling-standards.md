TASK-003 — Padronização de ferramentas do workspace

Status

PLANNED

Objetivo

Configurar TypeScript, ESLint e Prettier compartilhados no monorepo, sem implementar funcionalidades de negócio.

Resultado observável

O repositório deve possuir:

packages/tsconfig/ com configurações base de TypeScript;
tsconfig.json na raiz como orchestrador de referências;
.prettierrc com configuração Prettier compartilhada;
.prettierignore;
eslint.config.mjs com configuração ESLint flat config;
scripts format:check e format:write na raiz;
pnpm typecheck, pnpm lint e pnpm format:check funcionando.

Contexto obrigatório

AGENTS.md
docs/ARCHITECTURE.md
docs/REPOSITORY_MAP.md
ai/tasks/TASK-003-tooling-standards.md

Arquivos permitidos

packages/tsconfig/package.json
packages/tsconfig/base.json
packages/tsconfig/library.json
tsconfig.json
.prettierrc
.prettierignore
eslint.config.mjs
package.json (somente devDependencies e scripts)
turbo.json (somente nova task format:check)
pnpm-lock.yaml (atualizado por pnpm install)

Arquivos proibidos

implementação de frontend;
implementação de backend;
Docker Compose;
banco de dados;
módulos de domínio;
documentação de módulos;
ADRs existentes.

Requisitos

Configurar TypeScript em modo strict.
Criar package interno packages/tsconfig para compartilhar configurações base.
Configurar ESLint com flat config (eslint.config.mjs).
Configurar Prettier na raiz.
Adicionar scripts format:check e format:write.
Não criar nestjs.json ou nextjs.json: não existem apps ainda.

Fora do escopo

Next.js;
NestJS;
aplicações;
banco de dados;
Redis;
autenticação;
configurações específicas de app (emitDecoratorMetadata, jsx).

Critérios de aceite

pnpm install funciona após adição de devDependencies;
pnpm lint não falha na ausência de arquivos TypeScript;
pnpm format:check não falha na ausência de arquivos de código;
packages/tsconfig é reconhecido pelo workspace;
nenhuma aplicação ou funcionalidade de negócio criada.

Validação

node --version
pnpm --version
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
git diff --check
git status

Commit recomendado

chore: add typescript, eslint, and prettier to workspace
