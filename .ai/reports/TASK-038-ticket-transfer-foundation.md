Relatório da TASK-038

Status

COMPLETED

Arquivos alterados

- `apps/api/prisma/migrations/20260812000016_ticket_transfers/migration.sql`: criado — tabela `ticket_transfers` com partial unique index `(ticket_id) WHERE status='PENDING'` e índices auxiliares
- `apps/api/prisma/schema.prisma`: modelo `TicketTransfer` adicionado; relações em `Ticket` e `Organization`
- `apps/api/src/modules/tickets/domain/ticket-transfer.entity.ts`: criado — entidade com `isPending()` e `isExpired()`
- `apps/api/src/modules/tickets/domain/ticket-transfer.errors.ts`: criado — 5 erros de domínio estáveis (`TransferAlreadyPendingError`, `TransferExpiredError`, `TransferAlreadyAcceptedError`, `TicketAlreadyAdmittedError`, `TransferNotFoundError`)
- `apps/api/src/modules/tickets/domain/ports/ticket-transfer-repository.port.ts`: criado — port com `findPendingByTicketId`, `findByClaimTokenHash`, `create`, `cancel`
- `apps/api/src/modules/tickets/application/use-cases/initiate-transfer.use-case.ts`: criado — gera `claimToken` (64 hex), persiste `claim_token_hash = SHA-256`
- `apps/api/src/modules/tickets/application/use-cases/initiate-transfer.use-case.spec.ts`: criado — 6 testes unitários
- `apps/api/src/modules/tickets/application/use-cases/cancel-transfer.use-case.ts`: criado
- `apps/api/src/modules/tickets/application/use-cases/cancel-transfer.use-case.spec.ts`: criado — 3 testes unitários
- `apps/api/src/modules/tickets/application/use-cases/accept-transfer.use-case.ts`: criado — `SELECT FOR UPDATE` + re-verificação dentro da transação + rotação atômica de credencial
- `apps/api/src/modules/tickets/application/use-cases/accept-transfer.use-case.spec.ts`: criado — 8 testes unitários
- `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts`: criado — SQL nativo com `$queryRaw` e `$transaction`
- `apps/api/src/modules/tickets/infrastructure/tickets.infrastructure.module.ts`: alterado — registra `PrismaTicketTransferRepository` e `TICKET_TRANSFER_REPOSITORY`
- `apps/api/src/modules/tickets/presentation/controllers/ticket-transfer.controller.ts`: criado — `POST` e `DELETE` com `X-Reservation-Token`
- `apps/api/src/modules/tickets/presentation/controllers/public-transfer-accept.controller.ts`: criado — `POST /public/transfers/:claimToken/accept` sem autenticação
- `apps/api/src/modules/tickets/presentation/dto/transfer.dto.ts`: criado
- `apps/api/src/modules/tickets/tickets.module.ts`: alterado — registra 3 use cases e 2 controllers novos
- `apps/api/src/modules/checkin/infrastructure/adapters/ticket-access.adapter.ts`: alterado — `transferPending` agora usa `EXISTS(SELECT 1 FROM ticket_transfers WHERE status='PENDING')` em vez de `false` fixo
- `apps/api/test/integration/tickets/ticket-transfer.integration-spec.ts`: criado — 9 testes de integração incluindo aceite concorrente com `Promise.all`

Implementado

- Fluxo completo de transferência: iniciar → aceitar / cancelar
- Rotação atômica de credencial no aceite: REVOKE antiga → INSERT nova em `$transaction` sequencial
- Prevenção de double accept: `SELECT ticket FOR UPDATE` + re-verificação de `transfer.status` dentro da transação
- `transferPending` real no `ticket-access.adapter.ts` — check-in agora detecta transferências pendentes
- `claim_token_hash` (SHA-256) persiste; `claimToken` plaintext nunca armazenado
- Partial unique index `(ticket_id) WHERE status='PENDING'` garante no máximo uma transferência pendente por ticket no banco

Decisões tomadas

- `AcceptTransferUseCase` re-verifica `transfer.status` dentro da transação para serializar aceites concorrentes; o segundo aceite vê `status='ACCEPTED'` e lança `TransferAlreadyAcceptedError` → 409
- Versão da nova credencial calculada como `MAX(version) + 1` dentro da transação — sem uso de sequence separado
- Sem Idempotency-Key no aceite público (o claim token já é o identificador único natural)
- `ticket-access.adapter.ts` usa `EXISTS` subquery em vez de JOIN para não afetar a seletividade do índice de credenciais

Testes executados

Comando	Resultado
`pnpm prisma generate`	aprovado
`pnpm --filter @ticket-seller/api typecheck`	aprovado (0 erros)
`pnpm --filter @ticket-seller/api test`	aprovado (246 testes unitários)
`pnpm --filter @ticket-seller/api test:integration`	aprovado (250 testes de integração)
`pnpm --filter @ticket-seller/api build`	aprovado

Riscos identificados

- Aceite × check-in simultâneos: `FOR UPDATE` no ticket resolve a ordem; o perdedor recebe 409 ou `TRANSFER_PENDING` — testado indiretamente
- Link de claim sem autenticação de usuário: design deliberado para MVP; qualquer pessoa com o link pode aceitar

Pendências

Nenhuma.

Documentação atualizada

- `.ai/reports/TASK-038-ticket-transfer-foundation.md` (este arquivo)
- `docs/CURRENT_STATE.md` (a atualizar)
- `.ai/coordination/ACTIVE_TASKS.md` (a atualizar)

Próxima tarefa recomendada

TASK-039 — Ticket Transfer Experience (marketplace frontend)
