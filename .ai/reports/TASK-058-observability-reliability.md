Relatório da TASK-058 — Observability, Reliability & Operational Alerts

Status

COMPLETED

Commit

(ver após commit)

Arquivos criados

apps/api/src/platform/observability/request-context.ts: AsyncLocalStorage singleton para RequestContext (requestId, userId?, organizationId?)
apps/api/src/platform/observability/request-context.service.ts: service NestJS injectable que expõe get/set sobre o storage; exportado para uso nos módulos de negócio
apps/api/src/platform/observability/correlation-id.middleware.ts: NestMiddleware que lê X-Request-Id (UUID v4) ou gera randomUUID, armazena no RequestContext e adiciona header X-Request-Id na resposta
apps/api/src/platform/observability/otel.setup.ts: bootstrap condicional do NodeSDK com OTLPTraceExporter; ativado se OTEL_ENABLED=true; registra handler SIGTERM para flush
apps/api/src/platform/observability/observability.module.ts: NestModule que registra CorrelationIdMiddleware via MiddlewareConsumer para todas as rotas — path '(.*)' compatível com path-to-regexp v6
apps/api/src/platform/observability/correlation-id.middleware.spec.ts: 3 testes unitários cobrindo geração de UUID, reuso de UUID válido e rejeição de UUID inválido

Arquivos alterados

apps/api/src/platform/config/env.ts: OTEL_ENABLED (boolean transform), OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT adicionados
apps/api/src/app.module.ts: ObservabilityModule importado; LoggerModule.forRoot expandido com genReqId (lê requestId do AsyncLocalStorage), redact de campos sensíveis, serializers de req/res, customSuccessMessage
apps/api/src/main.ts: setupOtel() chamado antes do NestFactory.create; app.enableShutdownHooks() já presente
apps/api/package.json: @opentelemetry/sdk-node, auto-instrumentations-node, exporter-trace-otlp-http, resources, semantic-conventions adicionados

Implementado

Correlation ID propagado em todas as requests via AsyncLocalStorage — sem acoplamento nos módulos de negócio.
Header X-Request-Id enviado de volta ao cliente (reusa o enviado se for UUID v4 válido).
Log de cada request inclui requestId via genReqId.
Redaction de authorization, cookie, x-dev-user-id, password, tokenHash, token_hash, hash nos logs.
Serializers de req/res com requestId, method, url, statusCode.
OTel opt-in: OTEL_ENABLED=true inicializa NodeSDK com OTLP HTTP exporter para Jaeger.
Health endpoints /health/live e /health/ready já existentes (TASK-053) — mantidos sem alteração.

Decisões

Path '(.*)' usado em forRoutes porque path-to-regexp v6.3.0 (via @fastify/middie) não aceita '*path' (modifier inesperado). '(.*)' é regex válido e funciona corretamente.
require() dinâmico usado em otel.setup.ts para evitar carregamento do SDK quando OTEL_ENABLED=false.
serviceName passado diretamente para NodeSDKConfiguration — evita importar Resource de @opentelemetry/resources v2.10.0 que mudou a API (Resource virou tipo, não classe).
AsyncLocalStorage singleton (não injectable) usado em LoggerModule.forRoot porque LoggerModule.forRoot é estático e não suporta injeção de dependência.

Testes

npx jest --config jest.config.ts --forceExit: 70 suites, 435 testes — APROVADO

Pendências

OTel não testado com Jaeger local (requer infraestrutura).

Próxima tarefa

TASK-059 — Security Hardening & Data Protection.
