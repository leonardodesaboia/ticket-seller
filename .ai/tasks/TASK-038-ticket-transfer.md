# TASK-038 — Ticket Transfer Foundation

## Status

PLANNED

## Objetivo

Transferência segura de ingresso com rotação atômica de credencial no aceite. A credencial antiga é revogada e a nova é criada somente após aceite válido — em uma única transação.

## Resultado observável

- `POST .../transfer` inicia transferência e retorna `{ claimToken, expiresAt }`.
- `DELETE .../transfer` cancela transferência pendente.
- `POST /public/transfers/:claimToken/accept` aceita transferência: revoga credencial antiga, cria nova, retorna `{ newCredentialToken }`.
- Aceite concorrente: somente uma transação completa; a outra falha com `TRANSFER_ALREADY_ACCEPTED`.
- Ticket com check-in `ADMITTED` não pode ser transferido.
- Token expirado → erro `TRANSFER_EXPIRED`.
- Após TASK-038 integrada, `PerformCheckInUseCase` (TASK-036) deve verificar `transferPending` real via query SQL — o campo não é mais sempre `false`.

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-038-ticket-transfer.md`
- `docs/modules/tickets.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/tickets/domain/ticket.entity.ts`
- `apps/api/src/modules/tickets/domain/ticket-credential.entity.ts`
- `apps/api/src/modules/tickets/domain/ports/ticket-credential-repository.port.ts`
- `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-credential.repository.ts`
- `apps/api/src/modules/checkin/infrastructure/adapters/ticket-access.adapter.ts`
- `apps/api/src/modules/tickets/infrastructure/adapters/ticket-order-access.adapter.ts`
- `apps/api/test/integration/tickets/public-ticket-credential.integration-spec.ts`

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/api/prisma/migrations/20260812000016_ticket_transfers/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/tickets/domain/ticket-transfer.entity.ts`
- `apps/api/src/modules/tickets/domain/ticket-transfer.errors.ts`
- `apps/api/src/modules/tickets/domain/ports/ticket-transfer-repository.port.ts`
- `apps/api/src/modules/tickets/application/use-cases/initiate-transfer.use-case.ts`
- `apps/api/src/modules/tickets/application/use-cases/initiate-transfer.use-case.spec.ts`
- `apps/api/src/modules/tickets/application/use-cases/cancel-transfer.use-case.ts`
- `apps/api/src/modules/tickets/application/use-cases/cancel-transfer.use-case.spec.ts`
- `apps/api/src/modules/tickets/application/use-cases/accept-transfer.use-case.ts`
- `apps/api/src/modules/tickets/application/use-cases/accept-transfer.use-case.spec.ts`
- `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts`
- `apps/api/src/modules/tickets/infrastructure/tickets.infrastructure.module.ts`
- `apps/api/src/modules/tickets/presentation/controllers/ticket-transfer.controller.ts`
- `apps/api/src/modules/tickets/presentation/controllers/public-transfer-accept.controller.ts`
- `apps/api/src/modules/tickets/presentation/dto/transfer.dto.ts`
- `apps/api/src/modules/tickets/tickets.module.ts`
- `apps/api/src/modules/checkin/infrastructure/adapters/ticket-access.adapter.ts`
- `apps/api/test/integration/tickets/ticket-transfer.integration-spec.ts`

## Arquivos proibidos

O agente não pode alterar:

- migrations aplicadas anteriores a `20260812000016`;
- módulos fora de `tickets/` e `checkin/infrastructure/adapters/ticket-access.adapter.ts`;
- arquivos gerados pelo Prisma;
- lockfile;
- documentação não relacionada.

## Requisitos funcionais

- `POST /api/v1/public/orders/:orderId/tickets/:ticketId/transfer`:
  - Autenticado por `X-Reservation-Token`.
  - Cria transferência `PENDING` com `claimToken` (64 hex) e `expiresAt` (+24h).
  - Somente uma transferência `PENDING` por ticket (partial unique index).
  - Retorna `{ claimToken, expiresAt }`.
- `DELETE /api/v1/public/orders/:orderId/tickets/:ticketId/transfer`:
  - Cancela transferência `PENDING` do ticket.
  - Retorna 204.
- `POST /api/v1/public/transfers/:claimToken/accept`:
  - Sem autenticação de usuário.
  - Busca transferência por `SHA-256(claimToken)`.
  - Valida: `PENDING`, não expirada, ticket não admitido.
  - Transação atômica: `SELECT ticket FOR UPDATE` → `REVOKE credencial antiga` → `INSERT nova credencial` → `UPDATE transfer → ACCEPTED`.
  - Retorna `{ newCredentialToken }`.

## Requisitos técnicos

- `claimToken = crypto.randomBytes(32).toString('hex')` — 64 hex.
- `token_hash = SHA-256(claimToken)` — único campo persistido.
- Partial unique index `(ticket_id) WHERE status='PENDING'` — no máximo uma transferência pendente por ticket.
- `accept` usa transação única com `SELECT ... FOR UPDATE` no ticket.
- `TRANSFER_PENDING` em `AdmissionContext`: `ticket-access.adapter.ts` deve verificar existência de `ticket_transfers WHERE status='PENDING'` para o ticket.

## Invariantes

- Credencial antiga revogada antes de nova ser criada no aceite — nunca duas `ACTIVE` ao mesmo tempo.
- Nova credencial gerada apenas após aceite válido — nunca antecipadamente.
- Ticket com check-in `ADMITTED` não pode ser transferido.
- Token e claim_token nunca armazenados em plaintext.
- Transferência já aceita ou cancelada não pode ser reprocessada.

## Segurança

- `claimToken` não logado.
- `claim_token_hash` nunca exposto em resposta.
- `POST /accept` sem autenticação de usuário — qualquer pessoa com o link pode aceitar (design deliberado para MVP).
- Token expirado retorna 400 com código estável `TRANSFER_EXPIRED` — sem revelar dados do ticket.

## Multi-tenancy

- `ticket-transfer` armazena `organization_id`.
- Iniciação e cancelamento filtram por `organization_id` (via reservation token → order → org).
- Aceite via claim token — não expõe `organization_id` (busca apenas pelo hash).

## Concorrência

- Dois aceites simultâneos do mesmo claim token:
  - `SELECT ticket FOR UPDATE` serializa; o segundo transaction vê `transfer.status = 'ACCEPTED'` e falha.
  - Resultado: exatamente uma rotação de credencial.
- Check-in × transferência: check-in usa `AdmissionPolicy` com `transferPending=true` → `TRANSFER_PENDING`; transferência × check-in simultâneos: o `FOR UPDATE` decide a ordem.
- Testado com `Promise.all` contra PostgreSQL real.

## Idempotência

- Iniciação: somente uma `PENDING` por ticket (partial unique index). Segunda chamada retorna 409.
- Aceite: `UPDATE transfer WHERE status='PENDING'` — idempotente via estado.
- Cancelamento: `UPDATE WHERE status='PENDING'` — segunda chamada retorna 404 (já cancelada).

## Fora do escopo

- Prazo de expiração configurável (fixo em 24h no MVP).
- Notificação por email ao destinatário (TASK futura).
- Interface de usuário (TASK-039).
- Transferência para usuário identificado (por ora, link público).
- Limite de transferências por ticket.

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários aprovados (mínimo 8);
- testes de integração aprovados (mínimo 8, incluindo concorrência de aceite e interação check-in × transfer);
- `claim_token_hash` ausente das respostas;
- `transferPending` real verificado no `ticket-access.adapter.ts`;
- nenhuma dependência adicionada sem justificativa.

## Comandos

```bash
cd apps/api && npx prisma generate
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration
pnpm --filter @ticket-seller/api build
```

## Conclusão esperada

### Arquivos alterados

- `apps/api/prisma/migrations/20260812000016_ticket_transfers/migration.sql`: criado
- `apps/api/prisma/schema.prisma`: modelo `TicketTransfer` adicionado
- `apps/api/src/modules/tickets/domain/ticket-transfer.entity.ts`: criado
- `apps/api/src/modules/tickets/application/use-cases/`: 3 use cases criados
- `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts`: criado
- `apps/api/src/modules/tickets/presentation/controllers/ticket-transfer.controller.ts`: criado
- `apps/api/src/modules/tickets/presentation/controllers/public-transfer-accept.controller.ts`: criado
- `apps/api/src/modules/checkin/infrastructure/adapters/ticket-access.adapter.ts`: `transferPending` real

### Implementado

- Fluxo completo de transferência: iniciar → aceitar / cancelar.
- Rotação atômica de credencial no aceite.
- `transferPending` real no check-in.

### Testes

```
pnpm test:              aprovado
pnpm test:integration:  aprovado (incluindo concorrência)
```

### Decisões

[a preencher pelo implementador]

### Pendências

Nenhuma.

### Próxima tarefa

TASK-039 — Ticket Transfer Experience.
