# Relatório da TASK-034 — Ticket Credential & QR Foundation

## Status

COMPLETED — MERGED em develop (commit cec4375). 7 testes unitários + 10 testes de integração. Typecheck e build limpos.

## Migration

- `apps/api/prisma/migrations/20260812000014_ticket_credentials/migration.sql`:
  - `UNIQUE(token_hash)` — sem colisão de hash.
  - `PARTIAL UNIQUE INDEX (ticket_id) WHERE status='ACTIVE'` — máximo uma credencial ativa por ticket.
  - FK para `tickets` e `organizations`.
  - `CHECK(status IN ('ACTIVE','REVOKED'))`.

## Arquivos criados

### Domínio
- `modules/tickets/domain/ticket-credential.entity.ts` — entidade com validação de 64 chars no `tokenHash`.
- `modules/tickets/domain/ticket-credential.errors.ts` — `CredentialNotFoundError`, `TicketCancelledError`.
- `modules/tickets/domain/ports/ticket-credential-repository.port.ts` — `ITicketCredentialRepository` com `findActiveByTicketId`, `findByTokenHash`, `createIfNoneActive`, `rotateCredential`.

### Aplicação
- `tickets/application/use-cases/issue-ticket-credential.use-case.ts` — cada POST gera novo token e rotaciona se já há credencial ativa.
- `tickets/application/use-cases/issue-ticket-credential.use-case.spec.ts` — 7 testes unitários.
- `tickets/application/use-cases/get-ticket-credential.use-case.ts` — retorna `boolean` (credencial existe).

### Infraestrutura
- `tickets/infrastructure/repositories/prisma-ticket-credential.repository.ts` — SQL nativo; `rotateCredential` via `$transaction` sequencial (UPDATE → INSERT).

### Apresentação
- `tickets/presentation/controllers/public-ticket-credential.controller.ts` — `POST 201` e `GET 200` com validação de token de reserva.
- `tickets/presentation/dto/credential.response.ts`.

### Arquivos modificados
- `apps/api/prisma/schema.prisma` — modelo `TicketCredential`, relações em `Ticket` e `Organization`.
- `tickets/infrastructure/tickets.infrastructure.module.ts` — registra `PrismaTicketCredentialRepository`.
- `tickets/tickets.module.ts` — adiciona use cases, controller e exporta `TICKET_CREDENTIAL_REPOSITORY`.

### Testes de integração
- `test/integration/tickets/public-ticket-credential.integration-spec.ts` — 10 cenários: POST sem token, token inválido, ticket de outro order, ticket cancelado, POST válido, rotação de credencial, GET sem credencial, GET após POST, concorrência (2 POSTs simultâneos → 1 credencial ativa), token_hash ausente das respostas.

## Decisões tomadas

1. Cada POST emite novo token (rotaciona sempre) — token não é reutilizável sem nova requisição, simplifica e aumenta segurança.
2. `$transaction` sequencial em vez de CTE para `rotateCredential` — CTE com múltiplos data-modifying statements em PostgreSQL não garante visibilidade entre etapas, violando o partial unique index.
3. GET retorna apenas `hasCredential: boolean` — token original nunca recuperável pelo servidor.

## Testes executados

| Comando | Resultado |
|---|---|
| `pnpm --filter @ticket-seller/api typecheck` | aprovado |
| `pnpm --filter @ticket-seller/api test` | aprovado (199 total) |
| `pnpm --filter @ticket-seller/api test:integration` | aprovado (231 total) |
| `pnpm --filter @ticket-seller/api build` | aprovado |

## Riscos identificados

- `DevelopmentActorAdapter` com `X-Dev-User-Id` é bloqueador de produção — não há autenticação real ainda.

## Pendências

Nenhuma para esta task.

## Documentação atualizada

- `.ai/tasks/TASK-034-ticket-credential-qr.md` — status COMPLETED.

## Próxima tarefa recomendada

TASK-036 — Check-in API & Audit Trail.
