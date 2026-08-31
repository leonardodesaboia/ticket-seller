# TASK-066 — Conformidade com a arquitetura hexagonal

## Status

COMPLETED

## Objetivo

Restaurar gradualmente a conformidade da API com ADR-004 e `docs/ARCHITECTURE.md`, sem alterar regras de negócio, contratos públicos, segurança, multi-tenancy, concorrência ou idempotência.

## Resultado observável

- domain e application não importam NestJS, Prisma, Fastify, Redis ou SDKs externos;
- infraestrutura é o único local de Prisma e SDKs de providers;
- módulos usam contracts públicos, facades ou eventos, nunca adapters/repositories internos de outro módulo;
- a validação arquitetural impede regressões;
- worker/scheduler só sai da API HTTP depois de decisão arquitetural aprovada.

## Contexto obrigatório

- `AGENTS.md`;
- esta task;
- `.ai/reports/ARCHITECTURE-CONFORMANCE-AUDIT-2026-08-26.md`;
- `.ai/reports/TASK-064-api-architecture-conformance-assessment.md`;
- `docs/ARCHITECTURE.md`;
- ADR-004 e ADR-006;
- somente os módulos e testes da fase em execução.

## Arquivos permitidos

- `.ai/scripts/validate-architecture.sh` e testes/documentação associados;
- `apps/api/src/modules/**` somente para a fase aprovada;
- `apps/api/src/platform/**` somente para composição Nest ou entrypoint aprovado;
- `apps/api/test/**` e specs co-localizadas afetadas;
- relatório da TASK-066 e documentação/ADR estritamente necessária.

## Arquivos proibidos

- migrations aplicadas e schema Prisma sem task específica/Database Owner;
- DTOs, rotas e OpenAPI, salvo task aprovada para neutralizar payments;
- package/lockfile sem aprovação;
- mudanças incidentais de produto, autorização ou regra financeira.

## Fases obrigatórias

### Fase 1 — Guardrails e P0

1. Remover `Prisma.TransactionClient` do port de transferências de tickets.
2. Preservar aceitação atômica em operação específica do adapter; não criar repository ou unit-of-work genérico.
3. Estender o validador para domain/application e infraestrutura de outro módulo.
4. Adicionar testes isolados ao validador.

### Fase 2 — Application pura

1. Remover `@Injectable` e `@Inject` dos use cases dos 14 módulos.
2. Fazer composição Nest via factories/providers fora da application.
3. Substituir `platform/config/env` em identity por port/input de configuração.
4. Usar platform-admin e media como referência de ports específicos, sem exceções permanentes.

### Fase 3 — Prisma e fronteiras entre módulos

1. Extrair ports específicos das 12 operações de payments/finance listadas no relatório.
2. Manter SQL, locks, índices e transações no adapter; não expor Prisma em contracts.
3. Eliminar bindings de adapters externos de organizations/events.
4. Converter imports internos entre checkin/tickets, inventory/events, payments/finance e venues/events em contracts públicos/facades/eventos.

### Fase 4 — Workers e scheduler

Bloqueada até ADR aprovada sobre entrypoints, polling ou broker, locks, retry/DLQ, shutdown e observabilidade. Não mover workers como refactor incidental das fases anteriores.

### Fase posterior — payments neutro a provider

Neutralizar `FAKE`, `FAKE_PIX` e `FAKE_CREDIT_CARD` somente após a Fase 3, em task própria, sem integrar PSP real.

## Invariantes

- domínio permanece TypeScript puro;
- application depende somente de domain, contracts permitidos e shared kernel comprovadamente compartilhado;
- todo recurso multi-tenant mantém `organizationId` no contrato e na persistência;
- ledger, estoque, check-in, outbox e locks preservam SQL parametrizado, transações e constraints;
- webhooks, emissão, refund, payout, transferência e check-in preservam idempotência;
- não criar `GenericRepository<T>` ou abstração genérica sem uso concreto.

## Segurança, concorrência e idempotência

Não registrar secrets, tokens, cartão, CVV ou corpos sensíveis. Não remover guards, validações ou rate limiting. Cada migração crítica exige teste PostgreSQL real ou cobertura equivalente de lock/constraint e preserva `SELECT FOR UPDATE`, `SKIP LOCKED`, retries de serialização, índices únicos e ordem de deduplicação.

## Fora do escopo

- microserviços;
- novo PSP, broker, fila ou provedor de e-mail;
- schema/migrations sem task dedicada;
- separação de worker/scheduler sem ADR;
- contrato público de payments nesta task.

## Plano esperado antes de cada fase

1. módulos e arquivos exatos;
2. contract/facade e respectivo proprietário;
3. preservação de tenant, transação, lock e idempotência;
4. plano RED → GREEN → refactor;
5. compatibilidade da composição Nest e rollback;
6. testes específicos.

## Critérios de aceite

- Fase 1 concluída antes da Fase 2;
- nenhuma dependência proibida em domain/application ao fim da Fase 3;
- nenhum contract expõe Prisma/client de infraestrutura;
- nenhum módulo instancia infraestrutura de outro;
- imports intermodulares passam por contract público permitido;
- validador cobre e aprova as regras aplicáveis;
- testes unitários, integração, isolamento multi-tenant e concorrência afetados passam;
- typecheck, lint, build e diff check passam ou falhas preexistentes são registradas;
- Fase 4 não inicia sem ADR aprovada.

## Comandos

- `bash .ai/scripts/validate-architecture.sh`
- `pnpm --filter @ticket-seller/api test -- --runInBand`
- `pnpm --filter @ticket-seller/api test:integration`
- `pnpm --filter @ticket-seller/api typecheck`
- `pnpm --filter @ticket-seller/api lint`
- `pnpm --filter @ticket-seller/api build`
- `git diff --check`

## Conclusão esperada

Relatar arquivos por fase, comportamento, decisões/ADR, testes, riscos, pendências e a próxima fase independente.
