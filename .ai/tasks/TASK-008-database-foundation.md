# TASK-008 — Database Foundation

## Identificador

TASK-008

## Título

Database Foundation

## Objetivo

Integrar Prisma com PostgreSQL na API, criar as migrations fundacionais, implementar PrismaService com lifecycle correto, atualizar health check para verificar banco real e criar testes de integração com Testcontainers.

## Status

IN_PROGRESS

## Dependências

TASK-007

## Propriedade exclusiva (Database Owner)

- `prisma/**`
- `apps/api/src/platform/database/**`
- `apps/api/test/integration/**`
- `apps/api/src/platform/config/env.ts`
- `apps/api/src/platform/health/health.controller.ts`
- `apps/api/src/platform/health/health.module.ts`
- `apps/api/src/app.module.ts`
- `apps/api/jest.integration.config.ts`
- `apps/api/package.json`
- `turbo.json`

## Arquivos proibidos

- `apps/marketplace-web/**`
- `apps/backoffice-web/**`
- `.github/**`
- Qualquer arquivo de domínio ou presentation

## Resultado observável

- Prisma conectado ao PostgreSQL
- PrismaService com graceful shutdown
- GET /api/v1/health/ready verificando banco real
- 3 migrations fundacionais aplicadas em PostgreSQL limpo
- Testes de integração com Testcontainers passando

## Critérios de aceite

- [ ] PrismaService criado em platform/database/
- [ ] DatabaseModule registrado como @Global
- [ ] DATABASE_URL validado por Zod
- [ ] GET /api/v1/health/live → 200 sem depender do banco
- [ ] GET /api/v1/health/ready → 200 com banco, 503 sem banco
- [ ] 3 migrations criadas e válidas
- [ ] Testes de integração com Testcontainers passando
- [ ] pnpm lint → PASS
- [ ] pnpm typecheck → PASS
- [ ] pnpm test → PASS
- [ ] pnpm build → PASS

## Comandos de validação

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ticket-seller/api test:integration
pnpm build
```

## Formato de conclusão

Relatório em `.ai/reports/TASK-008-database-foundation.md`
