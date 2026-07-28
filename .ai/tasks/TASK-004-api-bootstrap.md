TASK-004 — API Bootstrap

Status

READY

Responsável

Não atribuído.

Objetivo

Criar a aplicação base do backend em apps/api/ usando NestJS com adapter Fastify. Sem módulos de negócio, banco de dados, Prisma ou autenticação.

Resultado observável

GET /api/v1/health/live → 200 OK
GET /api/v1/health/ready → 200 OK
pnpm build passa sem erros de TypeScript
pnpm test passa
pnpm lint passa
pnpm typecheck passa
Logs estruturados em JSON visíveis no console
Request ID presente no header de resposta

Coordenação

Branch

feature/TASK-004-api-bootstrap

Worktree

../ticket-seller-task-004

Dependências obrigatórias

TASK-003 (MERGED)

Pode executar em paralelo com

TASK-005
TASK-006

Não pode executar em paralelo com

Nenhuma outra tarefa em apps/api/**

Propriedade exclusiva

apps/api/**

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

packages/tsconfig/nestjs.json (leitura)

Contratos produzidos

GET /api/v1/health/live → 200 OK { status: "ok" }
GET /api/v1/health/ready → 200 OK { status: "ok" }
RFC 9457 para erros: { type, title, status, detail, instance }

Contexto obrigatório

Leia somente:

AGENTS.md
esta tarefa

Arquivos permitidos

apps/api/** (todos os arquivos dentro deste diretório)

Arquivos proibidos

Qualquer arquivo fora de apps/api/
package.json da raiz
pnpm-lock.yaml
turbo.json
pnpm-workspace.yaml
packages/**
infra/**
compose.yaml
apps/marketplace-web/**
docs/**
.ai/**

Requisitos

1. Criar apps/api/package.json com nome @ticket-seller/api, scripts e dependências
2. Criar apps/api/tsconfig.json estendendo @ticket-seller/tsconfig/nestjs.json
3. Criar apps/api/src/main.ts com bootstrap do NestJS + Fastify
4. Configurar graceful shutdown (SIGTERM/SIGINT via enableShutdownHooks)
5. Configurar global prefix: api/v1
6. Configurar CORS via @fastify/cors
7. Configurar Helmet via @fastify/helmet
8. Configurar logger Pino via nestjs-pino e pino-http
9. Configurar request ID via fastify requestId
10. Configurar global exception filter compatível com RFC 9457
11. Configurar global ValidationPipe (whitelist, transform, forbidNonWhitelisted)
12. Configurar Swagger via @nestjs/swagger em GET /api/docs
13. Criar apps/api/src/app.module.ts como módulo raiz
14. Criar apps/api/src/config/env.ts com schema Zod para variáveis de ambiente
15. Criar apps/api/src/health/health.module.ts e health.controller.ts
16. Implementar GET /api/v1/health/live → { status: "ok" }
17. Implementar GET /api/v1/health/ready → { status: "ok" }
18. Criar apps/api/src/common/filters/http-exception.filter.ts (RFC 9457)
19. Criar apps/api/jest.config.ts
20. Criar apps/api/test/health.e2e-spec.ts com testes dos dois endpoints
21. Criar apps/api/.env.example

Dependências a instalar em apps/api/package.json

Runtime (dependencies):
@nestjs/common
@nestjs/core
@nestjs/platform-fastify
@nestjs/config
@nestjs/swagger
@nestjs/terminus
fastify
@fastify/cors
@fastify/helmet
nestjs-pino
pino-http
class-validator
class-transformer
reflect-metadata
rxjs
zod

Dev (devDependencies):
@nestjs/testing
@types/node
jest
ts-jest
supertest
@types/supertest
pino-pretty
typescript (usar mesma versão do workspace: 5.9.3)

Após criar apps/api/package.json, executar pnpm install na raiz do worktree.
Isso atualizará o pnpm-lock.yaml DO WORKTREE (não o canonical — o integrador resolverá no merge).

Variáveis de ambiente esperadas (.env.example)

PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGINS=*

Estrutura de diretórios esperada

apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── env.ts
│   ├── health/
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   └── common/
│       └── filters/
│           └── http-exception.filter.ts
├── test/
│   └── health.e2e-spec.ts
├── .env.example
├── jest.config.ts
├── package.json
└── tsconfig.json

RFC 9457 — Formato de erro obrigatório

{
  "type": "https://httpstatuses.com/400",
  "title": "Bad Request",
  "status": 400,
  "detail": "mensagem de erro",
  "instance": "/api/v1/recurso"
}

O filtro global deve converter qualquer HttpException para este formato.

Invariantes

O domínio não pode ser importado nesta tarefa.
Nenhuma conexão real com banco pode ser feita.
Nenhum módulo de negócio pode ser criado.
Sem Prisma, sem TypeORM, sem qualquer ORM.

Segurança

Não registrar secrets ou tokens em log.
Não expor stack traces em produção (verificar NODE_ENV).
Helmet deve estar ativo.
CORS deve estar configurado (não usar * em produção — .env.example deve ter comentário).

Multi-tenancy

Não aplicável nesta tarefa (sem módulos de negócio).

Concorrência

Não aplicável nesta tarefa.

Idempotência

Não aplicável nesta tarefa.

Fora do escopo

Prisma
Banco de dados
Redis
Autenticação
Autorização
Módulos de domínio (identity, organizations, events, etc.)
Worker
Scheduler
Docker
CI/CD
Qualquer regra de negócio

Critérios de aceite

propriedade respeitada (apenas apps/api/**);
nenhum arquivo global alterado;
GET /api/v1/health/live → 200;
GET /api/v1/health/ready → 200;
pnpm lint aprovado;
pnpm typecheck aprovado;
pnpm test aprovado;
pnpm build aprovado (tsc compila sem erro);
scan de secrets aprovado;
relatório criado em .ai/reports/TASK-004-api-bootstrap.md;
commit realizado na branch feature/TASK-004-api-bootstrap.

Comandos de validação

pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api build
curl -s http://localhost:3000/api/v1/health/live | jq .
curl -s http://localhost:3000/api/v1/health/ready | jq .
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
Contratos afetados
Commit

Commit recomendado

feat(api): bootstrap NestJS API with health checks [TASK-004]
