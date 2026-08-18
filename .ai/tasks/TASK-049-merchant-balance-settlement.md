TASK-049 — Merchant Balance & Settlement

Status: PLANNED

Objetivo

Criar o saldo materializado do produtor (`seller_balances`), o registro de settlements (`balance_settlements`) e o worker de settlement event-based, que move saldo de PENDING para AVAILABLE após o evento ocorrer + janela de segurança configurada em `fee_policies.settlement_delay_days`.

Resultado observável

- Tabelas `seller_balances` e `balance_settlements` criadas.
- `seller_balances` atualizado atomicamente junto com os lançamentos de ledger (RecordSaleUseCase, RecordRefundUseCase, RecordChargebackUseCase).
- `SettlementWorker` processa orders elegíveis e move pending → available.
- `GET /api/v1/organizations/:orgId/finance/balance` retorna pendingAmount, availableAmount, reservedAmount.
- Saldo negativo possível e representado corretamente (D10).
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-049-merchant-balance-settlement.md
- docs/modules/finance.md
- apps/api/src/modules/finance/ (código de TASK-047 e TASK-048)
- apps/api/prisma/schema.prisma (estado após TASK-048)
- apps/api/src/modules/events/domain/ (para acessar event.endsAt)
- apps/api/src/modules/notifications/ (referência ao padrão de worker existente — OutboxNotificationWorker)

Arquivos permitidos

O agente pode criar ou alterar somente:
- apps/api/prisma/migrations/20260818000027_seller_balances/migration.sql (NOVO)
- apps/api/prisma/schema.prisma (adicionar SellerBalance e BalanceSettlement)
- apps/api/src/modules/finance/domain/entities/seller-balance.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/entities/balance-settlement.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/ports/seller-balance.repository.port.ts (NOVO)
- apps/api/src/modules/finance/domain/ports/settlement-policy.port.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts (EXPANDIR — atualizar seller_balances)
- apps/api/src/modules/finance/application/use-cases/record-refund.use-case.ts (EXPANDIR)
- apps/api/src/modules/finance/application/use-cases/record-chargeback.use-case.ts (EXPANDIR)
- apps/api/src/modules/finance/application/use-cases/settle-order.use-case.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/get-organization-balance.use-case.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/repositories/prisma-seller-balance.repository.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/adapters/fee-policy-settlement.adapter.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/workers/settlement.worker.ts (NOVO)
- apps/api/src/modules/finance/presentation/controllers/finance.controller.ts (NOVO)
- apps/api/src/modules/finance/finance.module.ts (EXPANDIR)
- apps/api/test/integration/finance/settlement.integration-spec.ts (NOVO)

Arquivos proibidos

- Migrations anteriores a 20260818
- apps/api/src/modules/orders/ (sem alterações)
- apps/api/src/modules/payments/ (sem alterações adicionais)
- pnpm-lock.yaml

Requisitos funcionais

1. `seller_balances`: pending_amount, available_amount, reserved_amount (todos BIGINT, sem CHECK >= 0 em pending/available).
2. `balance_settlements`: UNIQUE(order_id) — um settlement por order.
3. `SettlementWorker` (OnModuleInit/OnModuleDestroy — igual ao OutboxNotificationWorker):
   a. Polling a cada 1h.
   b. Busca orders TICKETS_ISSUED cujo `event.ends_at + settlement_delay_days <= now()`.
   c. Sem OFFSET — drain-the-queue (chunk de 50, FOR UPDATE SKIP LOCKED).
   d. Cria balance_settlement (ON CONFLICT DO NOTHING — idempotente).
   e. Atualiza seller_balance: pending -= seller_net_amount, available += seller_net_amount.
4. `ISettlementPolicyPort.getDelayDays(orgId)` lê de `fee_policies` (orgId → fallback global).
5. `GetOrganizationBalanceUseCase` retorna { pendingAmount, availableAmount, reservedAmount, currency }.
6. `GET /organizations/:orgId/finance/balance` com ActorGuard (OWNER, ADMIN, FINANCE roles).
7. Saldo negativo permitido — não adicionar CHECK >= 0 em pending/available.
8. `RecordSaleUseCase` atualiza seller_balance: pending += seller_net.
9. `RecordRefundUseCase` reduz pending ou available (dependendo do estado do settlement).
10. `RecordChargebackUseCase` reduz available (pode ficar negativo).

Requisitos técnicos

- `seller_balances` com `version` para optimistic locking.
- Settlement worker com `setInterval` + clearInterval no destroy.
- `ISettlementPolicyPort` não lê ENV — lê de `fee_policies`.
- SQL nativo para SELECT FOR UPDATE no settlement loop.
- Testes de integração com Testcontainers.

Invariantes

- reserved_amount >= 0 (CHECK constraint — reserva não pode ser negativa).
- pending_amount e available_amount podem ser negativos (D10).
- Um order tem no máximo um balance_settlement (UNIQUE order_id).
- Settlement não altera ledger_entries já existentes.
- Saldo atualizado na mesma transação que o ledger entry.

Segurança

- Endpoint `GET /finance/balance` exige ActorGuard com role OWNER, ADMIN ou FINANCE.
- Cross-tenant: filtro obrigatório por organizationId no path.
- Valores em minor units.
- Nenhuma informação de ledger interno exposta no response público.

Multi-tenancy

- seller_balances.organization_id — UNIQUE por org.
- balance_settlements.organization_id — índice.
- GetOrganizationBalance filtra sempre por organizationId do path.

Concorrência

- SELECT FOR UPDATE em seller_balances antes de qualquer UPDATE.
- Dois settlements do mesmo order → UNIQUE(order_id) em balance_settlements previne duplicata.
- Múltiplas instâncias do worker: FOR UPDATE SKIP LOCKED no loop de settlement.

Idempotência

- ON CONFLICT DO NOTHING em balance_settlements.
- RecordSaleUseCase já idempotente via ledger_transactions.UNIQUE.

Fora do escopo

- Payout e reserva de saldo para payout (TASK-051).
- API de transações/histórico (TASK-052).
- Política de fee por organização (futura).
- Saldo negativo → cobrança automática do produtor (fora do MVP).

Critérios de aceite

- Migration cria seller_balances e balance_settlements com constraints corretas.
- SettlementWorker processa orders elegíveis e move pending → available.
- GET /finance/balance retorna valores corretos.
- Testes de integração: venda, refund antes e após settlement, chargeback, saldo negativo passam.
- Concorrência: dois settlements do mesmo order → apenas um processado.
- pnpm lint, typecheck, test, test:integration aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration --testPathPattern=finance
pnpm --filter @ticket-seller/api prisma validate
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-050 — Payout Provider & Split Foundation
