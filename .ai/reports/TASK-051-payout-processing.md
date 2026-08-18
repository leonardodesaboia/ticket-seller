Relatório da TASK-051 — Payout Processing
Status

COMPLETED

Arquivos alterados
apps/api/prisma/migrations/20260818000029_payouts/migration.sql: NOVO — tabelas payouts (UNIQUE idempotency_key) e payout_webhook_events (UNIQUE provider + provider_event_id)
apps/api/prisma/schema.prisma: adicionados modelos Payout e PayoutWebhookEvent
apps/api/src/modules/finance/domain/entities/payout.entity.ts: NOVO — PayoutStatus type + Payout interface
apps/api/src/modules/finance/domain/ports/payout.repository.port.ts: NOVO — IPayoutRepository
apps/api/src/modules/finance/infrastructure/repositories/prisma-payout.repository.ts: NOVO — SQL nativo para FOR UPDATE, ON CONFLICT
apps/api/src/modules/finance/application/use-cases/create-payout.use-case.ts: NOVO — fluxo atômico com SELECT FOR UPDATE
apps/api/src/modules/finance/application/use-cases/create-payout.use-case.spec.ts: NOVO — 8 testes unitários
apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.ts: NOVO — deduplicação + transições idempotentes
apps/api/src/modules/finance/presentation/controllers/finance.controller.ts: EXPANDIDO — POST /finance/payouts
apps/api/src/modules/finance/presentation/controllers/payout-webhook.controller.ts: NOVO — POST /webhooks/payouts/fake sem autenticação de usuário, HMAC obrigatório
apps/api/src/modules/finance/finance.module.ts: EXPANDIDO
apps/api/test/integration/finance/payout.integration-spec.ts: NOVO

Implementado
CreatePayoutUseCase: SELECT FOR UPDATE em seller_balances serializa payouts concorrentes; two payouts com available=1000 e amount=800 → apenas um aprovado.
Transação fechada antes da chamada ao provider (COMMIT → gateway.createPayout) — nunca transação aberta durante I/O externo.
Idempotência: UNIQUE(idempotency_key) em payouts + ON CONFLICT retorna existente sem double-reserve.
Ledger PAYOUT_REQUESTED: DEBIT SELLER_PAYABLE, CREDIT PAYOUT_CLEARING.
ProcessPayoutWebhookUseCase: deduplicação via UNIQUE(provider, provider_event_id); transições idempotentes (PAID/FAILED já aplicado → no-op).
SUCCEEDED: reserved -= amount, ledger PAYOUT_SUCCEEDED (DEBIT PAYOUT_CLEARING, CREDIT PLATFORM_CLEARING).
FAILED: reserved -= amount, available += amount, ledger PAYOUT_FAILED (DEBIT PAYOUT_CLEARING, CREDIT SELLER_PAYABLE).
InsufficientBalanceException (HTTP 422) quando available < amount requisitado.

Decisões tomadas
IPayoutRepository.create() retorna { payout, inserted: boolean } — se inserted=false, o use case pula atualização de saldo e ledger (idempotência completa).
Verificação de saldo ocorre dentro da transação após SELECT FOR UPDATE — sem TOCTOU.
external_payout_id nunca exposto em mensagens de erro de usuário.

Testes executados
Comando	Resultado
pnpm --filter @ticket-seller/api prisma validate	aprovado
pnpm --filter @ticket-seller/api typecheck	aprovado (0 erros)
pnpm --filter @ticket-seller/api lint	6 erros pré-existentes
pnpm --filter @ticket-seller/api test	8/8 em create-payout.use-case.spec.ts; total 348 passando

Riscos identificados
Testes de integração (Testcontainers) não executados sem banco disponível.

Pendências
Nenhuma de código.

Documentação atualizada
Nenhuma (documentação de fase será atualizada na conclusão de TASK-052).

Próxima tarefa recomendada
TASK-052 — Financial Dashboard & Reconciliation
