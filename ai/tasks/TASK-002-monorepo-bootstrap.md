TASK-002 — Inicialização do monorepo
Status

PLANNED

Objetivo

Inicializar o workspace sem implementar funcionalidades de negócio.

Resultado observável

O repositório deve possuir:

package.json na raiz;
pnpm-workspace.yaml;
configuração inicial do Turborepo;
scripts básicos;
Node.js fixado;
workspace reconhecido pelo pnpm.
Contexto obrigatório
AGENTS.md
docs/ARCHITECTURE.md
docs/REPOSITORY_MAP.md
.ai/tasks/TASK-002-monorepo-bootstrap.md
Arquivos permitidos
package.json
pnpm-workspace.yaml
turbo.json
.npmrc
.node-version
.nvmrc
pnpm-lock.yaml
apps/.gitkeep
packages/.gitkeep
Arquivos proibidos
implementação de frontend;
implementação de backend;
Docker Compose;
banco de dados;
módulos de domínio;
documentação não relacionada.
Requisitos
Configurar pnpm workspace.
Configurar Turborepo.
Fixar versão LTS do Node.js.
Criar scripts básicos.
Não criar aplicações ainda.
Fora do escopo
Next.js;
NestJS;
PostgreSQL;
Redis;
Prisma;
autenticação.
Critérios de aceite

pnpm install funciona;

workspace é reconhecido;

scripts de raiz existem;

nenhuma aplicação foi criada;

nenhuma dependência de runtime foi adicionada.

Validação
node --version
pnpm --version
pnpm install
pnpm exec turbo --version
git diff --check
Commit recomendado
chore: initialize pnpm monorepo