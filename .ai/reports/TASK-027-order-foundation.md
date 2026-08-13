# Relatório da TASK-027 — Order Foundation

## Status

MERGED em develop

## Arquivos alterados

- `apps/api/prisma/schema.prisma` e migration `20260811000009_orders`: tabelas, relações, índices e constraints de orders.
- `apps/api/src/modules/orders/`: módulo hexagonal, casos de uso, adapters Prisma, controller e DTOs públicos.
- `apps/api/test/integration/orders/public-orders.integration-spec.ts`: contratos e concorrência PostgreSQL real.
- Coordenação e relatório: rastreabilidade da tarefa.

## Implementado

Criação e consulta pública de pedido protegido pelo token de continuação da reserva. A criação copia snapshots, mantém inventário reservado, consome a reserva e grava `order.created.v1` na mesma transação serializável.

## Decisões tomadas

- A migration recebeu número sequencial `20260811000009_orders`, pois `20260811000008_reservations` já estava aplicada.
- O adapter usa SQL parametrizado nas operações críticas, preservando compatibilidade com o Prisma Client atualmente defasado e mantendo a transação no PostgreSQL.
- Taxas permanecem pendentes: `totalAmount = subtotalAmount`.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ticket-seller/api typecheck` | Aprovado |
| `pnpm --filter @ticket-seller/api lint` | Aprovado |
| `pnpm --filter @ticket-seller/api test` | Aprovado (25 suites, 150 testes) |
| `pnpm --filter @ticket-seller/api build` | Aprovado |
| Integração focada de Orders com Testcontainers | Aprovado (8 testes) |

## Riscos identificados

A suíte global de integração depende de Docker/Testcontainers; a validação focada de Orders foi executada com PostgreSQL real.

## Pendências

Nenhuma.

## Documentação atualizada

`.ai/tasks/TASK-027-order-foundation.md`, `.ai/coordination/ACTIVE_TASKS.md` e este relatório. Documentação de módulo não foi alterada.

## Próxima tarefa recomendada

TASK-028 — Marketplace Reservation & Checkout Preparation.
