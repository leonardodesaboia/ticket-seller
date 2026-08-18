TASK-051 — Payout Processing

Status: PLANNED

Objetivo

Implementar o fluxo completo de payout manual: criação com reserva atômica de saldo, chamada ao provider, webhook de confirmação/falha, lançamentos no ledger e atualização de seller_balances. Concorrência é o risco crítico — dois payouts simultâneos não podem ultrapassar o saldo disponível.

Resultado observável

- Tabelas `payouts` e `payout_webhook_events` criadas.
- `POST /organizations/:orgId/payouts` cria payout reservando available_amount atomicamente.
- Dois payouts concorrentes com available=1000 e amount=800 → apenas um criado.
- Webhook SUCCEEDED → payout SUCCEEDED, reserved -= amount, ledger PAYOUT_SUCCEEDED.
- Webhook FAILED → payout FAILED, reserved liberado, available restaurado, ledger reversal.
- Saldo insuficiente retorna 422.
- Idempotência via UNIQUE(idempotency_key).
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-051-payout-processing.md
- .ai/tasks/TASK-050-payout-provider.md (interface PayoutGatewayPort)
- docs/modules/payouts.md
- docs/modules/finance.md
- apps/api/src/modules/finance/ (código existente — balances, ledger, recipient)
- apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts (referência de padrão)
- apps/api/prisma/schema.prisma (estado após TASK-050)

Arquivos permitidos

O agente pode criar ou alterar somente:
- apps/api/prisma/migrations/20260818000029_payouts/migration.sql (NOVO)
- apps/api/prisma/schema.prisma (adicionar Payout e PayoutWebhookEvent)
- apps/api/src/modules/finance/domain/entities/payout.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/ports/payout.repository.port.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/create-payout.use-case.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/repositories/prisma-payout.repository.ts (NOVO)
- apps/api/src/modules/finance/presentation/controllers/finance.controller.ts (EXPANDIR)
- apps/api/src/modules/finance/presentation/controllers/payout-webhook.controller.ts (NOVO)
- apps/api/src/modules/finance/finance.module.ts (EXPANDIR)
- apps/api/src/modules/finance/application/use-cases/create-payout.use-case.spec.ts (NOVO)
- apps/api/test/integration/finance/payout.integration-spec.ts (NOVO)

Arquivos proibidos

- Migrations anteriores a 20260818
- apps/api/src/modules/payments/ (sem alterações)
- apps/api/src/modules/orders/ (sem alterações)
- pnpm-lock.yaml

Requisitos funcionais

1. `payouts`: id, organization_id, recipient_id, amount, currency, status, provider, external_payout_id, idempotency_key (UNIQUE), failure_reason, timestamps.
2. `payout_webhook_events`: UNIQUE(provider, provider_event_id) — deduplicação.
3. `CreatePayoutUseCase`:
   a. Verificar recipient VERIFIED.
   b. BEGIN → SELECT FOR UPDATE em seller_balances.
   c. Verificar available_amount >= amount → InsufficientBalanceError (422) se não.
   d. INSERT payouts (ON CONFLICT idempotency_key → retorna existente).
   e. UPDATE seller_balances: available -= amount, reserved += amount.
   f. Ledger PAYOUT_REQUESTED: DEBIT SELLER_PAYABLE[org], CREDIT PAYOUT_CLEARING[org].
   g. COMMIT.
   h. [fora da transação] gateway.createPayout → persistir external_payout_id, status=PROCESSING.
4. `ProcessPayoutWebhookUseCase`:
   a. parseWebhookEvent (HMAC-SHA256 validado).
   b. INSERT payout_webhook_events (ON CONFLICT DO NOTHING).
   c. Localizar payout por external_payout_id.
   d. SUCCEEDED: UPDATE payout→SUCCEEDED, seller_balances reserved -= amount. Ledger PAYOUT_SUCCEEDED: DEBIT PAYOUT_CLEARING[org], CREDIT PLATFORM_CLEARING.
   e. FAILED: UPDATE payout→FAILED, seller_balances reserved -= amount, available += amount. Ledger PAYOUT_FAILED: DEBIT PAYOUT_CLEARING[org], CREDIT SELLER_PAYABLE[org].
5. `POST /organizations/:orgId/payouts` — ActorGuard (OWNER, FINANCE).
6. `POST /webhooks/payouts/fake` — sem autenticação de usuário, HMAC obrigatório.

Requisitos técnicos

- Nunca manter transação aberta durante chamada HTTP ao provider.
- SELECT FOR UPDATE em seller_balances para concorrência.
- FOR UPDATE em payout_webhook_events pelo padrão existente (ON CONFLICT DO NOTHING).
- SQL nativo onde Prisma não suporta FOR UPDATE adequadamente.
- Testes de integração com Testcontainers.

Invariantes

- available_amount nunca vai abaixo de zero por payout (verificado antes da reserva).
- reserved_amount >= 0 sempre.
- Um payout não pode ser SUCCEEDED/FAILED duas vezes (guard no use case).
- Mesmo webhook não processa o mesmo payout duas vezes (UNIQUE provider_event_id).
- Ledger entries de payout balanceiam.

Segurança

- HMAC-SHA256 + timingSafeEqual no webhook.
- endpoint /payouts exige OWNER ou FINANCE role.
- Amount do payout vem do body — validado contra available_amount do banco.
- external_payout_id não exposto em erros (não revelar estado do provider).
- Cross-tenant: verificar orgId do path = org do payout.

Multi-tenancy

- payouts.organization_id — sempre verificado no use case.
- payout_webhook_events: lookup via external_payout_id → payout → organization_id (nunca via request param).

Concorrência (crítica)

- Cenário: available=1000, payout A=800, payout B=800.
- SELECT FOR UPDATE serializa: A passa, B falha com InsufficientBalanceError.
- Teste de integração obrigatório para este cenário.

Idempotência

- UNIQUE(idempotency_key) em payouts.
- ON CONFLICT em payout_webhook_events.
- Mesmo payout_webhook processado duas vezes → idempotente.

Fora do escopo

- Payout automático/scheduled (futura).
- Múltiplos providers.
- Cancelamento de payout (futura).
- Relatório e dashboard (TASK-052).

Critérios de aceite

- Migrations payouts e payout_webhook_events criadas.
- POST /payouts cria payout, reserva saldo, dispara provider.
- Webhook SUCCEEDED processa corretamente.
- Webhook FAILED restaura saldo.
- Concorrência: dois payouts simultâneos → apenas um reserva o saldo.
- Saldo insuficiente → 422.
- Idempotência: mesmo idempotency_key → mesmo payout.
- pnpm lint, typecheck, test, test:integration aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration --testPathPattern=payout
pnpm --filter @ticket-seller/api prisma validate
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-052 — Financial Dashboard & Reconciliation
