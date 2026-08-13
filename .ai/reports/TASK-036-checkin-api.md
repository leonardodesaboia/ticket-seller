# Relatório da TASK-036 — Check-in API & Audit Trail

## Status

COMPLETED — MERGED em develop (commit 99c280e). 6 testes unitários + 10 testes de integração. Typecheck e build limpos.

## Migration

- `apps/api/prisma/migrations/20260812000015_check_ins/migration.sql`:
  - `PARTIAL UNIQUE INDEX check_ins_single_entry_idx ON check_ins(ticket_id) WHERE result='ADMITTED'` — coração da prevenção de double check-in.
  - `UNIQUE(idempotency_key)` — replay seguro.
  - `CHECK(result IN ('ADMITTED','ALREADY_CHECKED_IN',…))` — 7 valores estáveis.
  - FK para `organizations`, `events`, `tickets`, `ticket_credentials`.

## Arquivos criados

### Domínio
- `src/modules/checkin/domain/check-in.entity.ts` — entidade `CheckIn` com `isAdmitted()`.
- `src/modules/checkin/domain/ports/check-in-repository.port.ts` — `ICheckInRepository` com `existsAdmittedForTicket`, `createCheckIn`, `findByIdempotencyKey`.

### Aplicação
- `src/modules/checkin/application/ports/event-access.port.ts` — `ICheckInEventAccessPort`.
- `src/modules/checkin/application/ports/ticket-access.port.ts` — `ICheckInTicketAccessPort`.
- `src/modules/checkin/application/use-cases/perform-check-in.use-case.ts` — fluxo completo com replay, hashing, `AdmissionPolicy`, persistência e captura de 23505.
- `src/modules/checkin/application/use-cases/perform-check-in.use-case.spec.ts` — 6 testes unitários.

### Infraestrutura
- `src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts` — SQL nativo; `ON CONFLICT (idempotency_key) WHERE NOT NULL DO UPDATE` para replay.
- `src/modules/checkin/infrastructure/adapters/event-access.adapter.ts` — busca evento por `id + organization_id`.
- `src/modules/checkin/infrastructure/adapters/ticket-access.adapter.ts` — JOIN `ticket_credentials → tickets` por `token_hash`; `transferPending` sempre `false` até TASK-038.
- `src/modules/checkin/infrastructure/checkin.infrastructure.module.ts`.

### Apresentação
- `src/modules/checkin/presentation/controllers/check-in.controller.ts` — `POST .../check-ins` com `ActorGuard`.
- `src/modules/checkin/presentation/dto/check-in.dto.ts` — `credential: string (64 hex)`, `notes?: string`.
- `src/modules/checkin/checkin.module.ts`.

### Arquivos modificados
- `apps/api/prisma/schema.prisma` — modelo `CheckIn`; relações `checkIns[]` em `Organization`, `Event`, `Ticket`, `TicketCredential`.
- `apps/api/src/app.module.ts` — `CheckInModule` importado.

### Testes de integração
- `test/integration/checkin/check-in.controller.integration-spec.ts` — 10 cenários: sem actor → 401, credential inválida → INVALID_CREDENTIAL, evento errado → WRONG_EVENT, evento não publicado → EVENT_NOT_ACTIVE, scan válido → ADMITTED, scan posterior → ALREADY_CHECKED_IN, concorrência com Promise.all → 1 ADMITTED + 1 ALREADY_CHECKED_IN, replay por Idempotency-Key, cross-tenant → INVALID_CREDENTIAL, resposta sem campos sensíveis.

## Decisões tomadas

1. `AdmissionCode = 'VALID'` mapeado para `CheckInResult = 'ADMITTED'` antes de persistir — o banco armazena `ADMITTED` conforme o CHECK constraint.
2. `INVALID_CREDENTIAL` sem ticket real não persiste no banco (sem FK válida) — apenas retorna a decisão.
3. PostgresError `23505` no partial unique index capturado no use case e convertido em `ALREADY_CHECKED_IN`.
4. Null safety em `$queryRaw` via template ternário para `performed_by_user_id`, `idempotency_key` e `notes`.

## Testes executados

| Comando | Resultado |
|---|---|
| `pnpm --filter @ticket-seller/api typecheck` | aprovado |
| `pnpm --filter @ticket-seller/api test` | aprovado (229 total) |
| `pnpm --filter @ticket-seller/api test:integration` | aprovado (241 total) |
| `pnpm --filter @ticket-seller/api build` | aprovado |

## Riscos identificados

- `transferPending` sempre `false` — TASK-038 deve implementar verificação real no `ticket-access.adapter`.
- `DevelopmentActorAdapter` (`X-Dev-User-Id`) é bloqueador de produção.

## Pendências

- `transferPending` real: TASK-038.
- Role check granular: fora do escopo MVP.

## Documentação atualizada

- `.ai/tasks/TASK-036-checkin-api.md` — status COMPLETED.

## Próxima tarefa recomendada

TASK-037 — Check-in Operator Interface.
