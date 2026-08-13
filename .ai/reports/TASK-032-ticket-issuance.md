# Relatório da TASK-032 — Ticket Issuance

## Status

MERGED em develop — 8 testes unitários + 221 testes de integração totais (9 novos de tickets), typecheck e build limpos.

## Migration

- `apps/api/prisma/migrations/20260812000013_tickets/migration.sql` — tabela `tickets`:
  - `UNIQUE(order_item_id, unit_index)` — idempotência de emissão por unidade.
  - `UNIQUE(public_code)` — código público único.
  - `CHECK(status IN ('ACTIVE','CANCELLED'))`.
  - `CHECK(unit_index >= 0)`.

## Arquivos criados

### Domínio
- `modules/tickets/domain/ticket.entity.ts` — entidade `Ticket` com validações no construtor (unitIndex >= 0, publicCode 64 chars).
- `modules/tickets/domain/ticket.errors.ts` — `TicketOrderNotFoundError`, `TicketInvalidTokenError`.
- `modules/tickets/domain/ports/ticket-repository.port.ts` — `ITicketRepository` + `TICKET_REPOSITORY`.

### Aplicação
- `tickets/application/ports/order-items-access.port.ts` — `IOrderItemsAccessPort` + `ORDER_ITEMS_ACCESS_PORT`.
- `tickets/application/ports/ticket-order-access.port.ts` — `ITicketOrderAccessPort` + `TICKET_ORDER_ACCESS_PORT`.
- `tickets/application/use-cases/issue-tickets.use-case.ts` — `executeWithItems` itera sobre itens e unidades, chama `createIfNotExists`; `executeForOrder` carrega os itens do banco.
- `tickets/application/use-cases/issue-tickets.use-case.spec.ts` — 5 testes unitários.
- `tickets/application/use-cases/get-order-tickets.use-case.ts` — valida token e retorna tickets.
- `tickets/application/use-cases/get-order-tickets.use-case.spec.ts` — 3 testes unitários.

### Infraestrutura
- `tickets/infrastructure/repositories/prisma-ticket.repository.ts` — `INSERT ... ON CONFLICT DO NOTHING RETURNING *`; busca existente em caso de conflito.
- `tickets/infrastructure/adapters/order-items-access.adapter.ts` — SQL nativo com JOIN orders→order_items.
- `tickets/infrastructure/adapters/ticket-order-access.adapter.ts` — hash SHA-256 do token contra `reservations.continuation_token_hash`.
- `tickets/infrastructure/tickets.infrastructure.module.ts`.

### Apresentação
- `tickets/presentation/controllers/public-tickets.controller.ts` — `GET /api/v1/public/orders/:orderId/tickets` com `X-Reservation-Token`.
- `tickets/presentation/dto/ticket.response.ts` — `TicketsResponse` e `TicketItemResponse`.
- `tickets/tickets.module.ts`.

### Integração com TASK-031 (modificado)
- `payments/application/use-cases/process-payment-webhook.use-case.ts` — após UPDATE order para PAID, emite tickets inline na mesma transação e atualiza order para TICKETS_ISSUED; outbox adiciona `order.tickets-issued.v1` e `tickets.issued.v1`.

### Testes de integração
- `test/integration/tickets/public-tickets.controller.integration-spec.ts` — 9 cenários: fluxo completo (webhook → TICKETS_ISSUED → GET tickets), idempotência (webhook duplicado não duplica tickets), token inválido → 401, order PENDING_PAYMENT → lista vazia, concorrência.

## Decisões

1. Emissão ocorre dentro da transação do webhook APPROVED — nenhum ticket sem order PAID.
2. `public_code = crypto.randomBytes(32).toString('hex')` — 64 chars, imprevisível, sem dados pessoais.
3. `TicketsModule` exporta `TicketsInfrastructureModule` (não os Symbols individualmente) para evitar erro NestJS de exportação de provider não declarado no módulo.
4. Testes de webhook atualizados: order vai para `TICKETS_ISSUED` (não `PAID`) e cleanup deleta `tickets` antes de `order_items`.

## Testes

| Tipo | Total | Resultado |
|---|---|---|
| Unitários | 8 | ✅ |
| Integração (novos) | 9 (incl. 1 concorrência) | ✅ |
| Integração (total suíte) | 221 | ✅ |
