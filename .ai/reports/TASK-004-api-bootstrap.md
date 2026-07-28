Relatório da TASK-004 — API Bootstrap (NestJS + Fastify)

Status

COMPLETED

Arquivos alterados

apps/api/package.json: criado
apps/api/tsconfig.json: criado — extends @ticket-seller/tsconfig/nestjs.json, types jest+node
apps/api/tsconfig.build.json: criado — exclui test/ da compilação de produção
apps/api/.env.example: criado
apps/api/jest.config.ts: criado
apps/api/jest.env.ts: criado — define NODE_ENV=test antes dos testes
apps/api/src/main.ts: criado — bootstrap NestJS + Fastify com CORS, Helmet, GlobalPrefix, ShutdownHooks, Swagger
apps/api/src/app.module.ts: criado — ConfigModule, LoggerModule (nestjs-pino), HealthModule
apps/api/src/config/env.ts: criado — schema Zod para variáveis de ambiente
apps/api/src/health/health.module.ts: criado
apps/api/src/health/health.controller.ts: criado — GET /live e GET /ready
apps/api/src/common/filters/http-exception.filter.ts: criado — RFC 9457
apps/api/test/health.e2e-spec.ts: criado — testes e2e dos dois endpoints

Implementado

Bootstrap NestJS 10 com FastifyAdapter
Global prefix: api/v1
GET /api/v1/health/live → 200 OK { status: "ok" }
GET /api/v1/health/ready → 200 OK { status: "ok" }
Global ValidationPipe (whitelist, transform, forbidNonWhitelisted)
Global HttpExceptionFilter (RFC 9457: type, title, status, detail, instance)
nestjs-pino: logs em JSON (silent em test, pino-pretty em development)
Request ID via Fastify requestId
Graceful shutdown via enableShutdownHooks
CORS via @fastify/cors
Helmet via @fastify/helmet
Swagger em GET /api/docs
Zod schema para validação de variáveis de ambiente

Testes executados

Comando	Resultado
tsc --noEmit	PASS
eslint {src,test}/**/*.ts	PASS
tsc -p tsconfig.build.json	PASS (sem erros)
jest (2 testes e2e)	PASS — 2/2 tests passed

Dependências instaladas

@nestjs/common ^10.4.0, @nestjs/core ^10.4.0, @nestjs/platform-fastify ^10.4.0
@nestjs/config ^3.3.0, @nestjs/swagger ^7.4.0, @nestjs/terminus ^10.2.3
fastify ^4.28.1, @fastify/cors ^8.5.0, @fastify/helmet ^11.1.1, @fastify/static ^7.0.4
nestjs-pino ^3.5.0, pino-http ^9.0.0
class-validator ^0.14.1, class-transformer ^0.5.1
reflect-metadata ^0.1.14, rxjs ^7.8.1, zod ^3.23.8
@nestjs/testing, ts-jest, ts-node, @types/jest, @types/node, pino-pretty, supertest

Nota: @nestjs/core e nestjs-pino têm build scripts (postinstall) que foram sinalizados como "ignored" pelo pnpm 11. Isso é normal — os pacotes funcionam corretamente sem o postinstall em ambiente de desenvolvimento.

Riscos

pnpm 11 sinaliza @nestjs/core e nestjs-pino como ERR_PNPM_IGNORED_BUILDS. Os pacotes funcionam sem os build scripts; para aprovar formalmente, adicionar ao pnpm.approvedBuilds no package.json raiz durante a integração.

Pendências

Nenhuma.

Contratos afetados

GET /api/v1/health/live → 200 OK { status: "ok" }
GET /api/v1/health/ready → 200 OK { status: "ok" }
GET /api/docs → Swagger UI

Commit recomendado

feat(api): bootstrap NestJS API with health checks [TASK-004]
