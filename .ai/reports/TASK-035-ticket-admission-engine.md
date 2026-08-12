# Relatório da TASK-035 — Ticket Validation & Admission Engine

## Status

COMPLETED — MERGED em develop (commit 0baf98e). 23 testes unitários. Typecheck limpo.

## Arquivos criados

- `apps/api/src/modules/tickets/domain/admission/admission-decision.ts` — tipo `AdmissionCode` (7 valores), interface `AdmissionDecision`, objeto imutável `ADMISSION` com decisões pré-construídas.
- `apps/api/src/modules/tickets/domain/admission/admission-context.ts` — interface `AdmissionContext` sem PII.
- `apps/api/src/modules/tickets/domain/admission/admission-policy.ts` — classe pura `AdmissionPolicy` com `evaluate(ctx)`.
- `apps/api/src/modules/tickets/domain/admission/admission-policy.spec.ts` — 23 testes unitários.
- `apps/api/src/modules/tickets/domain/admission/index.ts` — barrel export.

## Implementado

- `AdmissionPolicy.evaluate()` avalia 7 condições em ordem determinística: `INVALID_CREDENTIAL` → `TICKET_CANCELLED` → `WRONG_EVENT` → `EVENT_NOT_ACTIVE` → `TRANSFER_PENDING` → `ALREADY_CHECKED_IN` → `VALID`.
- `ACTIVE_EVENT_STATUSES = new Set(['PUBLISHED'])` — derivado da leitura do `event.entity.ts`.
- Prioridade de avaliação coberta por testes de composição.

## Decisões tomadas

1. `AdmissionPolicy` é classe pura sem `@Injectable` — instanciada diretamente no use case de check-in (TASK-036), sem DI container.
2. `ACTIVE_EVENT_STATUSES` contém apenas `PUBLISHED` — único status confirmado pelo domínio de eventos; outros (PAUSED, CANCELLED, COMPLETED, ARCHIVED) resultam em `EVENT_NOT_ACTIVE`.
3. `transferPending` sempre `false` nesta task — TASK-038 implementa verificação real na query SQL.

## Testes executados

| Comando | Resultado |
|---|---|
| `pnpm --filter @ticket-seller/api typecheck` | aprovado |
| `pnpm --filter @ticket-seller/api test` | aprovado (222 total, 23 novos) |

## Riscos identificados

Nenhum.

## Pendências

`transferPending` sempre `false` até TASK-038 implementar a coluna `ticket_transfers`.

## Documentação atualizada

- `.ai/tasks/TASK-035-ticket-admission-engine.md` — status COMPLETED.

## Próxima tarefa recomendada

TASK-036 — Check-in API & Audit Trail.
