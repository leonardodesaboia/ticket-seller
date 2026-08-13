# Relatório da TASK-030 — Payment Attempt

## Status

MERGED em develop — 10 testes unitários + 11 testes de integração, typecheck e build limpos.

## Migration

- `apps/api/prisma/migrations/20260812000010_payment_attempts/migration.sql` — tabela `payment_attempts`:
  - `UNIQUE(idempotency_key)` — idempotência de criação.
  - `UNIQUE INDEX(external_payment_id) WHERE external_payment_id IS NOT NULL` — índice parcial para deduplicação.
  - `CHECK(status IN ('PENDING','PROCESSING','APPROVED','DECLINED','CANCELLED','EXPIRED'))`.

## Arquivos criados

### Domínio
- `domain/payment-attempt.entity.ts` — entidade `PaymentAttempt` com `isActive()` e `isTerminal()`.
- `domain/payment-attempt.errors.ts` — 8 classes de erro: `PaymentAlreadyActiveError`, `OrderNotPendingPaymentError`, `InvalidPaymentMethodError`, `InvalidReservationTokenError`, `OrderNotFoundError`, `OrderExpiredError`, `OrderAmountZeroError`, `GatewayUnavailableError`.
- `domain/ports/payment-attempt-repository.port.ts` — `IPaymentAttemptRepository` + `PAYMENT_ATTEMPT_REPOSITORY`.

### Aplicação
- `application/ports/order-access.port.ts` — `IOrderAccessPort.findOrderWithToken(orderId, token)` + `ORDER_ACCESS_PORT`.
- `application/use-cases/create-payment-attempt.use-case.ts` — valida método, idempotência, token, status e expiração do order, tentativa ativa; amount vem exclusivamente de `order.totalAmount`.
- `application/use-cases/create-payment-attempt.use-case.spec.ts` — 7 testes unitários.
- `application/use-cases/get-payment-attempt.use-case.ts`.
- `application/use-cases/get-payment-attempt.use-case.spec.ts` — 3 testes unitários.

### Infraestrutura
- `infrastructure/adapters/order-access.adapter.ts` — JOIN orders→reservations, hash SHA-256 do token para comparação.
- `infrastructure/repositories/prisma-payment-attempt.repository.ts` — SQL nativo.

### Apresentação
- `presentation/controllers/public-payments.controller.ts` — `POST /api/v1/public/orders/:orderId/payments` e `GET /api/v1/public/orders/:orderId/payments/latest`.
- `presentation/dto/create-payment-attempt.dto.ts` — `@IsIn(['FAKE_PIX', 'FAKE_CREDIT_CARD'])`.
- `presentation/dto/payment-attempt.response.ts`.

### Testes de integração
- `test/integration/payments/public-payments.controller.integration-spec.ts` — 11 cenários: criação, idempotência, erros 401/404/409/410/422, PAYMENT_ALREADY_ACTIVE, nova tentativa após DECLINED.

## Decisões

1. Amount vem exclusivamente de `order.totalAmount` — nunca do body da requisição.
2. Token de reserva é comparado via hash SHA-256 armazenado em `reservations.continuation_token_hash`.
3. Gateway é chamado fora de transação de banco para evitar lock longo; idempotência garante consistência em caso de crash.

## Testes

| Tipo | Total | Resultado |
|---|---|---|
| Unitários | 10 | ✅ |
| Integração | 11 | ✅ |
