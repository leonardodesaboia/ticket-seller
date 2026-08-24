TASK-058 — Observability, Reliability & Operational Alerts

Status: PLANNED

Objetivo

Adicionar correlation IDs a todas as requests, enriquecer logs estruturados com contexto de autenticação e operação, separar liveness de readiness no health check, e configurar OpenTelemetry opt-in para traces distribuídos. Sem novas migrations de schema de produto.

Resultado observável

- Toda request possui `requestId` propagado em todos os logs do ciclo de vida.
- Logs de requests autenticadas incluem `userId`.
- Logs de operações financeiras incluem `orderId`, `payoutId` quando aplicável.
- `GET /health/live` → 200 `{ status: 'ok' }` mesmo se DB indisponível.
- `GET /health/ready` → 200 quando DB conectado e migrations aplicadas; 503 caso contrário.
- Com `OTEL_ENABLED=true`: traces aparecem no Jaeger local (ou no exporter configurado).
- Campos sensíveis redacted nos logs: `authorization`, `cookie`, `password`, `tokenHash`, `x-dev-user-id`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-058-observability-reliability.md
- apps/api/src/main.ts
- apps/api/src/app.module.ts
- apps/api/src/platform/config/env.ts
- apps/api/package.json (verificar nestjs-pino e @nestjs/terminus já instalados)

Sem migrations de produto

Esta task não altera schema de tabelas de negócio. Pode criar tabela de migração de schema de OTel apenas se necessário (improvável).

Arquivos permitidos

Backend:
- apps/api/src/platform/observability/ (NOVA pasta)
  - correlation-id.middleware.ts
  - request-context.service.ts (AsyncLocalStorage wrapper)
  - otel.setup.ts (bootstrap OpenTelemetry)
- apps/api/src/platform/http/health/ (NOVO ou expandir existente)
  - health-live.controller.ts
  - health-ready.controller.ts
- apps/api/src/main.ts (EXPANDIR — registrar middleware, OTel setup antes do bootstrap)
- apps/api/src/app.module.ts (EXPANDIR — MiddlewareConsumer, TerminusModule)
- apps/api/src/platform/config/env.ts (EXPANDIR — OTEL_ENABLED, OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT)

Arquivos proibidos

- apps/api/prisma/ (sem migrations de produto)
- Qualquer módulo de negócio (sem alterações diretas — context propagado via AsyncLocalStorage)
- pnpm-lock.yaml

Packages novos

```
@opentelemetry/sdk-node
@opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-trace-otlp-http
@opentelemetry/resources
@opentelemetry/semantic-conventions
```

Variáveis de ambiente novas

```
OTEL_ENABLED                 boolean, default false
OTEL_SERVICE_NAME            string, default 'ticket-seller-api'
OTEL_EXPORTER_OTLP_ENDPOINT  string, default 'http://localhost:4318'
```

Requisitos funcionais

1. Correlation ID middleware:
   - Lê `X-Request-Id` header (se presente e UUID válido) ou gera `crypto.randomUUID()`.
   - Armazena em `RequestContext` (AsyncLocalStorage).
   - Adiciona `X-Request-Id` ao header de resposta.
   - Injetado antes de qualquer handler via `MiddlewareConsumer.apply(...).forRoutes('*')`.

2. RequestContext service:
   - Wrapper sobre `AsyncLocalStorage<{ requestId: string; userId?: string; organizationId?: string }>`.
   - `get(key)`, `set(key, value)` — usado nos use cases para enriquecer contexto sem acoplamento.
   - Logger lê requestId do contexto automaticamente via pino-http `genReqId`.

3. Log enrichment (nestjs-pino):
   - `pino-http` config: `genReqId` lê do RequestContext.
   - `redact`: `['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-dev-user-id"]', '*.password', '*.tokenHash', '*.token_hash', '*.hash']`.
   - `serializers.req`: inclui `requestId`, `method`, `url`.
   - `serializers.res`: inclui `statusCode`, `durationMs`.
   - `customSuccessMessage`: `'{method} {url} {statusCode} {durationMs}ms'`.

4. Health endpoints:
   - `GET /health/live`:
     - Sempre retorna 200 `{ status: 'ok', timestamp: ISO }`.
     - Sem checks de dependências — só confirma que o processo está vivo.
   - `GET /health/ready`:
     - Usa `@nestjs/terminus` HealthCheckService.
     - Check: `PrismaHealthIndicator` — executa `SELECT 1` com timeout de 3s.
     - Check: migrations aplicadas — compara versão da última migration no filesystem com `_prisma_migrations` table.
     - 200 se todos passam, 503 caso contrário (body inclui detalhes do check que falhou).

5. OpenTelemetry (opt-in):
   - `otel.setup.ts` chamado antes do `NestFactory.create()` em `main.ts` se `OTEL_ENABLED=true`.
   - `NodeSDK` com `getNodeAutoInstrumentations()` — instrumeta HTTP, Prisma, NestJS automaticamente.
   - Exportador OTLP HTTP para `OTEL_EXPORTER_OTLP_ENDPOINT`.
   - Service name: `OTEL_SERVICE_NAME`.
   - Sem `sdk.start()` condicional dentro do código de negócio — todo instrumentação é automática.

6. Shutdown gracioso:
   - `app.enableShutdownHooks()` no `main.ts`.
   - Timeout de 10s para connections em flight.
   - OTel SDK flushed no `process.on('SIGTERM')`.

Invariantes

- `/health/live` nunca retorna 503 (processo morto = sem resposta, não 503).
- `/health/ready` nunca expõe connection strings ou credenciais na resposta.
- RequestContext propagado apenas via AsyncLocalStorage — sem injeção em módulos de negócio.
- Logs de error sempre incluem `requestId`.

Segurança

- Campos redacted cobrem todos os vetores de vazamento de credencial em logs.
- OTel traces nunca incluem valores de campos sensíveis (garantido pelo `@opentelemetry/auto-instrumentations-node` que redact headers configurados).
- Health endpoints sem autenticação (padrão de readiness probes).

Fora do escopo

- Métricas customizadas (Prometheus endpoint).
- Alertas automáticos (configuração de alertmanager ou similar).
- Distributed tracing com propagação entre frontends.
- Log aggregation pipeline (Loki, Elasticsearch).

Critérios de aceite

- Request sem X-Request-Id → header X-Request-Id na resposta com UUID gerado.
- Log de cada request inclui requestId, method, path, statusCode, durationMs.
- GET /health/live → 200 mesmo sem DB.
- GET /health/ready → 503 se DB indisponível, 200 se conectado.
- Com OTEL_ENABLED=true e Jaeger local: traces visíveis no UI do Jaeger para uma request de teste.
- Campos sensíveis (authorization header, password no body) não aparecem nos logs.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-059 — Security Hardening & Data Protection.
