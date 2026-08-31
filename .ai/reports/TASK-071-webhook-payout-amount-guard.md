# Relatório da TASK-071 — Guard de amount/currency no ProcessPayoutWebhookUseCase

## Status

COMPLETED

## Arquivos alterados

- `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.ts`: Passo 4 inserido entre o guard de status terminal e a construção de `webhookEventData`; call sites de `handleSucceeded` e `handleFailed` alterados de `amount`/`currency` (do evento) para `payout.amount`/`payout.currency` (da entidade persistida).
- `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.spec.ts`: criado — 15 casos cobrindo guards, dispatch e happy paths de ambos os handlers.

## Implementado

- Webhook com `amount` divergente do payout armazenado insere `finance.webhook-mismatch.v1` em `outbox_events` e retorna sem processar.
- Webhook com `currency` divergente tem o mesmo comportamento.
- `handleSucceeded` e `handleFailed` usam exclusivamente `payout.amount`/`payout.currency` como fonte autoritativa para operações de saldo e ledger.
- Mismatch outbox usa `transactionRunner.run` — mesma abstração dos handlers, garantindo rollback em caso de falha.
- `organization_id` sempre presente no insert do outbox.
- Nenhuma migration necessária — `outbox_events` já existe.

## Decisões tomadas

- O outbox do mismatch usa `return` após o insert (rejeição silenciosa): o webhook foi recebido e o mismatch foi registrado para auditoria, mas nenhuma operação financeira é realizada. Comportamento intencional e distinto do `ReconciliationWorker` (que continua processando após mismatch, por ser fonte confiável).
- A anotação de tipo do `transactionRunner` no spec foi simplificada para inferência (sem `jest.Mock<>` explícito) para evitar erro de parse do TypeScript em tipos genéricos aninhados.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ticket-seller/api exec tsc --noEmit` | Aprovado — 0 erros |
| `pnpm --filter @ticket-seller/api exec jest --runInBand --testPathPattern="process-payout-webhook"` | Aprovado — 15/15 |
| `pnpm --filter @ticket-seller/api exec jest --runInBand` | Aprovado — 581/581, 85 suites |
| `bash .ai/scripts/validate-architecture.sh` | APROVADA |
| `grep -rn "as any\|: any\|as unknown\|: unknown" [spec-file]` | 0 resultados |

## Pendências

Nenhuma.

## Próxima tarefa recomendada

TASK-070 — Modelo financeiro único para taxas do comprador e produtor (requer aprovação humana antes de iniciar).
