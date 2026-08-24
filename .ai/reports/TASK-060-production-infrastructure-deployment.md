# TASK-060 — Production Infrastructure & Deployment

Data: 2026-08-24

## Arquivos alterados

- `apps/api/Dockerfile` — NOVO: multi-stage (builder + runner), pnpm@11.17.0, prisma generate, non-root appuser
- `apps/api/.dockerignore` — NOVO
- `apps/marketplace-web/Dockerfile` — NOVO: multi-stage Next.js standalone, `mkdir -p public` pre-build
- `apps/marketplace-web/.dockerignore` — NOVO
- `apps/backoffice-web/Dockerfile` — NOVO: same pattern as marketplace
- `apps/backoffice-web/.dockerignore` — NOVO
- `docker-compose.prod.yml` — NOVO: single-server compose com api-migrate init container
- `apps/marketplace-web/next.config.ts` — `output: 'standalone'` adicionado
- `apps/backoffice-web/next.config.ts` — `output: 'standalone'` adicionado
- `.github/workflows/ci.yml` — step `Validate Dockerfiles` adicionado ao job `build`
- `docs/configuration.md` — NOVO: referência de variáveis de ambiente de todos os apps
- `pnpm-workspace.yaml` — fix: `argon2: set this to true or false` → `argon2: true`

## Implementado

### Dockerfiles multi-stage

Todos os três apps têm Dockerfiles multi-stage com:
- Builder: instala dependências, compila TypeScript / Next.js standalone
- Runner: node:22-alpine, usuário não-root `appuser`, HEALTHCHECK via wget, mínimo de camadas

API especificamente: copia `dist/`, `node_modules/`, `prisma/` e `node_modules/.prisma` para suportar
tanto a API em runtime quanto o init container `api-migrate` (que executa `prisma migrate deploy`).

### docker-compose.prod.yml

Deploy single-server com:
- `db` (postgres:17-alpine), `redis` (7-alpine + requirepass), `minio` (latest)
- `api-migrate`: init container com `entrypoint: prisma migrate deploy`, `restart: "no"`
  - `api` só sobe após `api-migrate: condition: service_completed_successfully`
- `marketplace` e `backoffice`: independentes, sem depends_on da API
- Todos os env vars via interpolação `${VAR}` ou `${VAR:-default}`

### CI — Dockerfile validation

Step adicionado ao job `build` após `pnpm build`:
```yaml
- name: Validate Dockerfiles
  run: |
    docker build -f apps/api/Dockerfile . -t test-api --no-cache
    docker build -f apps/marketplace-web/Dockerfile . -t test-marketplace --no-cache
    docker build -f apps/backoffice-web/Dockerfile . -t test-backoffice --no-cache
```

### docs/configuration.md

Referência completa de variáveis de ambiente: API (core, database, auth, Redis, object storage,
email, payout, OpenTelemetry), marketplace-web, backoffice-web e variáveis auxiliares do compose.
Inclui checklist de production readiness.

## Decisões

- `pnpm@11.17.0` explícito no Dockerfile em vez de `pnpm@latest` para builds reproduzíveis
- `mkdir -p apps/*/public` no builder antes do build — Next.js standalone falha se `public/` não existe
- HEALTHCHECK usa wget (disponível em alpine) em vez de curl
- API Dockerfile CMD: `node dist/src/main.js` (saída do tsc com rootDir=src é `dist/src/`)
- `argon2: true` em `pnpm-workspace.yaml` — placeholder anterior causava falha no `pnpm install`

## Testes

- `docker compose -f docker-compose.prod.yml config`: aprovado (sem erros, apenas warnings de variáveis não definidas)
- `pnpm lint`: aprovado
- `pnpm typecheck`: aprovado

## Pendências

- Verificação local dos `docker build` (requer imagem node:22-alpine ~700MB — CI valida)
- Escolha do cloud target e registry para push das imagens (fora do escopo — ADR-009)

## Próxima tarefa

TASK-061 — Backup, Disaster Recovery & Operational Runbooks
