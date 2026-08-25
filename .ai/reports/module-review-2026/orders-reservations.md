# Revisão de Módulo — orders + reservations

**Data:** 2026-08-24  
**Revisor:** Claude Sonnet 4.6 (análise automatizada)  
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

Os módulos `orders` e `reservations` implementam o fluxo de compra desde a reserva temporária até a criação do pedido. A análise encontrou **3 críticos**, **5 altos**, **10 médios** e **3 baixos**. Os problemas mais graves: `cancel()` de reserva sem `FOR UPDATE` pode deixar inventory negativo, idempotência criada antes de validações na criação de pedido, e IDOR no cancelamento de pedidos.

---

## Problemas por Severidade

### CRÍTICO

#### C1 — `prisma-reservation.repository.ts:179`: `cancel()` sem FOR UPDATE — inventory pode ficar negativo
- **Arquivo:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts`
- **Problema:** A reserva é lida sem `FOR UPDATE`. Entre o `findReservation` e o `UPDATE reservations ... WHERE status = 'ACTIVE'`, outra transação pode consumir a reserva (criando um pedido). O inventory seria decrementado para uma reserva já CONSUMED, deixando `reserved` negativo.
- **Correção:** Adicionar `FOR UPDATE` ao `findReservation` dentro da transação de cancelamento, ou consolidar em `UPDATE ... WHERE id = ? AND status = 'ACTIVE' RETURNING *`.
- **Status:** PENDENTE

#### C2 — `reservation-access.adapter.ts:48`: Idempotency record criado ANTES das validações
- **Arquivo:** `apps/api/src/modules/orders/infrastructure/adapters/reservation-access.adapter.ts`
- **Problema:** `idempotencyRecord.create` ocorre antes de checar se a reserva está expirada/cancelada/consumed. Se houver falha e retry muito rápido, o cliente pode receber `OrderIdempotencyConflictError` indevido.
- **Correção:** Mover a criação do idempotency record para APÓS as verificações de status da reserva.
- **Status:** PENDENTE

#### C3 — `create-order.use-case.ts:19`: `requestHash` não inclui `idempotencyKey`
- **Arquivo:** `apps/api/src/modules/orders/application/use-cases/create-order.use-case.ts`
- **Problema:** O hash usa apenas `{ reservationId }`. Dois pedidos com `reservationId` idêntico mas `idempotencyKey` diferentes teriam o mesmo `requestHash`, podendo retornar replay de outra request.
- **Correção:** Incluir `idempotencyKey` no hash: `{ reservationId, idempotencyKey }`.
- **Status:** PENDENTE

---

### ALTO

#### A1 — `prisma-reservation.repository.ts:190,221`: Decremento de inventory sem `AND reserved >= quantity`
- **Problema:** `cancel()` e `expireReservation` decrementam inventory sem guard de underflow. Se chamados duas vezes concorrentemente, `reserved` fica negativo.
- **Correção:** Adicionar `AND reserved >= ${item.quantity}` no WHERE e verificar `affected === 0`.

#### A2 — `prisma-reservation.repository.ts:74`: `isSerializationFailure` não captura `40P01` (deadlock)
- **Problema:** Verifica apenas `P2034` e `40001`, omitindo `40P01` (deadlock detected). Deadlocks não disparam retry.
- **Correção:** Adicionar `|| String(error.message).includes('40P01')`.

#### A3 — `reservation-access.adapter.ts:56`: `total_amount = subtotal_amount` — taxas ignoradas
- **Arquivo:** linhas 56
- **Problema:** `total_amount` definido identicamente ao `subtotal_amount`. Taxas de plataforma nunca são aplicadas na criação do pedido.
- **Correção:** Aplicar `FeePolicy` do snapshot de preços ao calcular `total_amount`.

#### A4 — `reservation-access.adapter.ts:85`: `resolveUniqueConflict` — 3 queries fora de transação
- **Problema:** Três leituras separadas (`findUnique`, `findByIdempotencyKey`, `findOrderByIdempotencyKey`) fora de transação podem retornar dados stale, resultando em `OrderIdempotencyConflictError` indevido.
- **Correção:** Envolver em `$transaction` com leituras consistentes.

#### A5 — `order-cancellation.controller.ts:84`: IDOR — sem verificação de membership na org
- **Arquivo:** `apps/api/src/modules/orders/presentation/controllers/order-cancellation.controller.ts`
- **Problema:** `ActorGuard` autentica mas não verifica se o ator é membro de `orgId`. Qualquer usuário autenticado com um par `orgId + orderId` válido pode cancelar pedidos de outra organização.
- **Correção:** Adicionar `OrganizationRoleGuard` e `@RequireCapability(OrganizationCapability.FINANCE_READ)` ou equivalente.

---

### MÉDIO

#### M1 — `cancellation-policy.ts:16`: Status `PAID` não é cancellável
- **Problema:** `CANCELLABLE_STATUSES = ['PENDING_PAYMENT', 'TICKETS_ISSUED']`. Pedidos `PAID` não podem ser cancelados, criando janela pós-pagamento sem possibilidade de cancelamento.
- **Correção:** Documentar se intencional ou adicionar `PAID` à lista e tratar refund automático.

#### M2 — `prisma-reservation.repository.ts:197`: N+1 em `expireActiveReservations`
- **Problema:** Busca IDs de reservas expiradas e processa cada uma individualmente. 1000 reservas = 5000+ queries.
- **Correção:** Bulk UPDATE com JOIN no inventory.

#### M3 — `prisma-reservation.repository.ts:174`: Token hash comparado sem `timingSafeEqual`
- **Correção:** `crypto.timingSafeEqual(Buffer.from(reservation.continuation_token_hash), Buffer.from(tokenHash))`.

#### M4 — `prisma-reservation.repository.ts:171`: `get()` não trata status CONSUMED/CANCELLED
- **Problema:** Reservas CONSUMED ou CANCELLED retornam view normalmente sem erro.
- **Correção:** Lançar erro específico para cada status.

#### M5 — `prisma-order-cancellation.repository.ts:254`: N+1 em revogação de credenciais
- **Correção:** Usar `UPDATE ticket_credentials ... WHERE ticket_id = ANY(ARRAY[...]::uuid[])`.

#### M6 — `prisma-order-cancellation.repository.ts:323`: N+1 em outbox por ticket
- **Correção:** Usar `INSERT INTO outbox_events (VALUES (...), (...))` bulk.

#### M7 — `prisma-order-cancellation.repository.ts:143`: Inventory update sem verificar affected rows
- **Problema:** Se `reserved < quantity`, UPDATE não atualiza e pedido é cancelado com inventory incorreto.
- **Correção:** Verificar `affected === 0` e lançar erro de inconsistência.

#### M8 — `prisma-order.repository.ts:15`: Dois round-trips fora de transação
- **Correção:** Envolver em `$transaction` ou usar JOIN único.

#### M9 — `order.entity.ts:1`: `REFUNDED` ausente do tipo `OrderStatus`
- **Correção:** `export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'TICKETS_ISSUED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'`

#### M10 — `create-reservation.dto.ts`: `items` sem limite de tamanho
- **Correção:** Validar `items.length <= 10` com `BadRequestException`.

---

### BAIXO

#### B1 — `create-reservation.dto.ts`: `eventSlug` sem `@MaxLength` e `@Matches`
#### B2 — `create-reservation.dto.ts`: `@Allow()` em `items` — fora do padrão de validação
#### B3 — `public-reservations.controller.ts:137`: `NotFoundException` sem `code` estruturado

---

## Correções Implementadas

**2026-08-24 — Sessão 2 e 3**

| ID | Correção | Arquivo |
|---|---|---|
| C2 | `reservation-access.adapter.ts`: `idempotencyRecord.create` movido para APÓS as validações de status (EXPIRED/CANCELLED/CONSUMED). `findOrderByReservation` também movido antes da escrita. | `reservation-access.adapter.ts` |
| C3 | `create-order.use-case.ts`: `requestHash = SHA256({ reservationId, idempotencyKey })` — `idempotencyKey` incluída no hash. Spec atualizada. | `create-order.use-case.ts`, spec |
| A1 | `prisma-reservation.repository.ts`: `cancel()` e `expireReservation` usam `GREATEST(reserved - quantity, 0)` para prevenir underflow. `FOR UPDATE` adicionado no lock da reserva. Retry em serialization failure. | `prisma-reservation.repository.ts` |
| A5 | IDOR: `order-cancellation.controller.ts` agora tem `@UseGuards(ActorGuard, OrganizationRoleGuard)` e `@RequireCapability(OrganizationCapability.EVENTS_MANAGE)`. `orders.module.ts` atualizado com providers do guard. | `order-cancellation.controller.ts`, `orders.module.ts` |

**Pendente:**
- C1: `cancel()` de reserva ainda pode ter janela de TOCTOU se `findReservation` for feito antes do lock
- ~~A2: `isSerializationFailure` não captura `40P01`~~ — **CORRIGIDO 2026-08-25**: `msg.includes('40P01')` adicionado à função `isSerializationFailure`
- A3: `total_amount` sempre igual a `subtotal_amount` — taxas nunca aplicadas
- A4: `resolveUniqueConflict` — 3 queries fora de transação
- M2: N+1 em `expireActiveReservations`
- M5–M6: N+1 em revogação de credenciais e outbox por ticket
- M9: `REFUNDED` ausente do tipo `OrderStatus`
