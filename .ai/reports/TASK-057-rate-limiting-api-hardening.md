Relatório da TASK-057 — Rate Limiting, Abuse Prevention & API Hardening

Status

COMPLETED

Commit

e9c9287 — feat(api): implement TASK-057 — rate limiting, abuse prevention & API hardening

Arquivos alterados

apps/api/package.json: dependências @nestjs/throttler v6 e nestjs-throttler-storage-redis v0.5.1 adicionadas
apps/api/src/platform/http/decorators/throttle.decorator.ts: criado — AuthLoginThrottle, AuthForgotThrottle, AuthRegisterThrottle, AuthRefreshThrottle, InvitationThrottle, ReservationThrottle, PaymentThrottle + re-export SkipThrottle
apps/api/src/platform/http/guards/smart-throttler.guard.ts: criado — SmartThrottlerGuard extends ThrottlerGuard; usa IP+email como chave composta em rotas autenticadas via metadata THROTTLE_USE_EMAIL_KEY
apps/api/src/app.module.ts: ThrottlerModule.forRootAsync (global 200/min, Redis opcional via REDIS_URL) + APP_GUARD SmartThrottlerGuard
apps/api/src/main.ts: @fastify/helmet com CSP completo, HSTS, noSniff, frameguard; @fastify/cors com origens estritas; bodyLimit 1MB; enableShutdownHooks
apps/api/src/platform/config/env.ts: REDIS_URL adicionado; validação de produção: CORS_ORIGINS não pode ser wildcard
apps/api/src/modules/identity/presentation/controllers/auth.controller.ts: @AuthRegisterThrottle, @AuthLoginThrottle, @AuthRefreshThrottle, @AuthForgotThrottle aplicados
apps/api/src/modules/payments/presentation/controllers/payment-webhook.controller.ts: @SkipThrottle no nível da classe
apps/api/src/modules/finance/presentation/controllers/payout-webhook.controller.ts: @SkipThrottle no nível da classe
apps/api/src/modules/organizations/presentation/controllers/invitations.controller.ts: @InvitationThrottle em POST :token/accept
apps/api/src/modules/reservations/presentation/controllers/public-reservations.controller.ts: @ReservationThrottle em POST
apps/api/src/modules/payments/presentation/controllers/public-payments.controller.ts: @PaymentThrottle em POST
pnpm.json: criado — onlyBuiltDependencies para pnpm v11
package.json: onlyBuiltDependencies migrado para pnpm.json (pnpm v11 não lê campo pnpm em package.json)

Erros pré-existentes corrigidos (não eram do escopo de TASK-057, mas bloqueavam lint)
perform-check-in.use-case.ts: import AdmissionCode removido (nunca usado)
order-refund.controller.ts: const uuidPipe module-level substituído por new ParseUUIDPipe inline
issue-ticket-credential.use-case.spec.ts: 3x any substituídos por jest.Mocked<T> com imports de tipo corretos
prisma-ticket-transfer.repository.ts: duplo ?? 0 desnecessário removido

Implementado

Throttling global (200 req/min) via SmartThrottlerGuard como APP_GUARD global.
Limites por rota: login 5/15min, forgot-password 3/1h, register 10/1h, refresh 20/5min, invitation 10/1h, reservation 20/60s, payment 10/5min.
Webhooks (payment e payout) excluídos do throttling via @SkipThrottle.
Redis opcional: se REDIS_URL for definido, ThrottlerStorageRedisService é usado; caso contrário, memória local.
CSP, HSTS, frameguard, referrer-policy configurados via @fastify/helmet.
CORS estrito com origens explícitas (wildcard bloqueado em produção).
Body limit 1MB no FastifyAdapter.

Decisões

@nestjs/throttler v6 usa interface increment() no storage; nestjs-throttler-storage-redis v0.5.1 implementa esta interface.
Throttler único nomeado 'global' evita múltiplos throttlers aplicados cumulativamente a todas as rotas.
SmartThrottlerGuard sobrescreve handleRequest (não getTracker) porque getTracker no guard recebe apenas req, enquanto handleRequest recebe ExecutionContext completo com acesso ao body.
pnpm.json é necessário porque pnpm v11 não lê o campo pnpm de package.json.

Testes

npx jest --config jest.config.ts --forceExit: 69 suites, 432 testes — APROVADO

Pendências

Nenhuma

Próxima tarefa

TASK-058 — Observability, Reliability & Operational Alerts.
