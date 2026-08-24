TASK-060 — Production Infrastructure & Deployment

Status: PLANNED

Objetivo

Criar Dockerfiles multi-stage para os três apps, documentar a estratégia de deployment (init container para migrations, health checks, graceful shutdown), criar referência de `docker-compose.prod.yml` para deploy em servidor único, e adicionar step de build de imagem Docker ao CI. Sem alterações de código de negócio.

Resultado observável

- `docker build -f apps/api/Dockerfile .` produz imagem válida.
- `docker build -f apps/marketplace-web/Dockerfile .` produz imagem válida.
- `docker build -f apps/backoffice-web/Dockerfile .` produz imagem válida.
- `docker-compose.prod.yml` define todos os serviços necessários para deploy single-server.
- `docker-compose.prod.yml` inclui init container que executa `prisma migrate deploy` antes da API.
- CI valida os Dockerfiles no job de build.
- `docs/configuration.md` lista todas as variáveis de ambiente de todos os apps com descrição, obrigatoriedade e exemplo.
- `pnpm typecheck`, `pnpm lint` aprovados (sem alterações de lógica).

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-060-production-infrastructure-deployment.md
- apps/api/package.json
- apps/marketplace-web/package.json
- apps/backoffice-web/package.json
- package.json (raiz)
- .github/workflows/ci.yml
- apps/api/src/platform/config/env.ts (para listar variáveis)
- docker-compose.yaml (estado atual do compose de desenvolvimento)

Sem migrations de produto

Esta task não altera schema de banco.

Arquivos permitidos

- apps/api/Dockerfile (NOVO)
- apps/api/.dockerignore (NOVO)
- apps/marketplace-web/Dockerfile (NOVO)
- apps/marketplace-web/.dockerignore (NOVO)
- apps/backoffice-web/Dockerfile (NOVO)
- apps/backoffice-web/.dockerignore (NOVO)
- docker-compose.prod.yml (NOVO — referência de deploy single-server)
- .github/workflows/ci.yml (EXPANDIR — job de docker build)
- docs/configuration.md (NOVO — todas as variáveis de ambiente)

Arquivos proibidos

- docker-compose.yaml (não alterar o compose de desenvolvimento)
- Qualquer arquivo em apps/*/src/ (sem alterações de código)
- pnpm-lock.yaml

Dockerfile — apps/api

```dockerfile
# Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile
COPY apps/api/ apps/api/
RUN pnpm --filter @ticket-seller/api build
RUN pnpm --filter @ticket-seller/api prisma generate

# Runner
FROM node:22-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- http://localhost:3000/health/live || exit 1
CMD ["node", "dist/main.js"]
```

Dockerfile — apps/marketplace-web e apps/backoffice-web

Ambos seguem o padrão Next.js standalone output:

```dockerfile
# Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/<appname>/package.json apps/<appname>/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile
COPY apps/<appname>/ apps/<appname>/
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ticket-seller/<appname> build

# Runner
FROM node:22-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/apps/<appname>/.next/standalone ./
COPY --from=builder /app/apps/<appname>/.next/static ./.next/static
COPY --from=builder /app/apps/<appname>/public ./public
USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "server.js"]
```

Next.js precisa de `output: 'standalone'` em `next.config.js` (verificar e adicionar se ausente).

docker-compose.prod.yml (referência single-server)

```yaml
version: '3.9'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ticket_seller
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data

  api-migrate:
    image: ticket-seller-api:${IMAGE_TAG:-latest}
    command: ["node", "-e", "require('@prisma/client'); process.exit(0)"]
    entrypoint: ["npx", "prisma", "migrate", "deploy"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      db:
        condition: service_healthy

  api:
    image: ticket-seller-api:${IMAGE_TAG:-latest}
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGINS: ${CORS_ORIGINS}
      FAKE_PAYOUT_SECRET: ${FAKE_PAYOUT_SECRET}
      OBJECT_STORAGE_PROVIDER: ${OBJECT_STORAGE_PROVIDER}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: ${MINIO_BUCKET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      FRONTEND_URL: ${FRONTEND_URL}
    depends_on:
      api-migrate:
        condition: service_completed_successfully
    ports:
      - "3000:3000"

  marketplace:
    image: ticket-seller-marketplace:${IMAGE_TAG:-latest}
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
    ports:
      - "3001:3001"

  backoffice:
    image: ticket-seller-backoffice:${IMAGE_TAG:-latest}
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
    ports:
      - "3002:3001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

Estratégia de deployment

1. Build das imagens Docker.
2. Push para registry (Docker Hub, GHCR, ECR — a definir conforme cloud escolhida).
3. `api-migrate` init container executa `prisma migrate deploy` — só prossegue se exit 0.
4. API sobe após migrate.
5. Frontends sobem independentemente (sem depender da API).

Lock de migrations: `prisma migrate deploy` é idempotente e usa advisory lock do Postgres — safe para múltiplas instâncias simultâneas.

Rollback: se migration falhar, `api-migrate` termina com exit != 0 e o deploy é abortado (compose `depends_on: condition: service_completed_successfully`).

docs/configuration.md

Documento listando todas as variáveis por app (API, marketplace, backoffice), com:
- Nome
- Obrigatório em production (sim/não)
- Valor default
- Descrição
- Exemplo

CI update

Adicionar ao `.github/workflows/ci.yml` no job `build`:
```yaml
- name: Validate Dockerfiles
  run: |
    docker build -f apps/api/Dockerfile . -t test-api --no-cache
    docker build -f apps/marketplace-web/Dockerfile . -t test-marketplace --no-cache
    docker build -f apps/backoffice-web/Dockerfile . -t test-backoffice --no-cache
```

Fora do escopo

- Kubernetes manifests / Helm charts.
- Cloud-specific configurations (ECS task definitions, Fly.io config).
- CDN configuration.
- Nginx / reverse proxy configuration.
- Secrets management (Vault, AWS SSM).
- Auto-scaling configuration.

Critérios de aceite

- `docker build -f apps/api/Dockerfile .` termina com exit 0.
- `docker build -f apps/marketplace-web/Dockerfile .` termina com exit 0.
- `docker build -f apps/backoffice-web/Dockerfile .` termina com exit 0.
- docker-compose.prod.yml é válido (`docker-compose -f docker-compose.prod.yml config` sem erros).
- docs/configuration.md lista todas as variáveis usadas em env.ts.
- CI job de build executa docker build.
- `pnpm lint`, `pnpm typecheck` aprovados.

Comandos

```bash
docker build -f apps/api/Dockerfile . -t ticket-seller-api:test
docker build -f apps/marketplace-web/Dockerfile . -t ticket-seller-marketplace:test
docker build -f apps/backoffice-web/Dockerfile . -t ticket-seller-backoffice:test
docker-compose -f docker-compose.prod.yml config
pnpm --filter @ticket-seller/api typecheck
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-061 — Backup, Disaster Recovery & Operational Runbooks.
