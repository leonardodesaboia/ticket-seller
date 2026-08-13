# Relatório da TASK-029 — Payment Port & Gateway Adapter

## Status

MERGED em develop — 17 testes unitários, typecheck e build limpos.

## Arquivos criados

### Domínio
- `apps/api/src/modules/payments/domain/ports/payment-gateway.port.ts` — porta `PaymentGatewayPort` com tipos `PaymentProvider`, `PaymentMethod`, `InternalPaymentStatus`, `PaymentWebhookEventType`; token `PAYMENT_GATEWAY_PORT = Symbol(...)`.
- `apps/api/src/modules/payments/domain/payment-gateway.errors.ts` — `GatewayError`, `GatewayTimeoutError`, `WebhookSignatureError`.

### Infraestrutura
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.ts` — `FakePaymentGateway` implementando `PaymentGatewayPort`:
  - `externalPaymentId = 'fake_' + SHA256(idempotencyKey).slice(0,32)` — determinístico por chave.
  - `parseWebhook` valida assinatura `sha256=<hex>` via `crypto.timingSafeEqual`.
  - Lança em produção se `FAKE_GATEWAY_SECRET` ausente.
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.spec.ts` — 17 testes unitários.
- `apps/api/src/modules/payments/infrastructure/payments.infrastructure.module.ts` — registra `PAYMENT_GATEWAY_PORT`.

### Módulo
- `apps/api/src/modules/payments/payments.module.ts` — módulo raiz, importa infraestrutura.

### App
- `apps/api/src/app.module.ts` — `PaymentsModule` adicionado.

## Decisões

1. `externalPaymentId` determinístico via SHA-256 da `idempotencyKey` garante retry-safe mesmo com crash após chamada ao PSP.
2. Validação HMAC usa `crypto.timingSafeEqual` para prevenir timing attacks.
3. `FAKE_GATEWAY_SECRET` obrigatório em produção; em desenvolvimento usa valor padrão `fake-secret-for-dev`.

## Testes

| Tipo | Total | Resultado |
|---|---|---|
| Unitários | 17 | ✅ |
