# Relatório da TASK-033 — Checkout Payment UI

## Status

MERGED em develop — 60 testes unitários, typecheck e build limpos.

## Arquivos criados

### API client
- `apps/marketplace-web/src/shared/api/public-payments.api.ts` — funções tipadas `createPaymentAttempt`, `getLatestPaymentAttempt`, `getOrderTickets` com tipos `PaymentAttemptResponse`, `TicketsResponse`, `PaymentMethod`, `AttemptStatus`.

### Features
- `features/payment-method/SelectMethodView.tsx` — seleção PIX / Cartão; `isCreating` desabilita botões com `aria-busy`; erro exibido com `role="alert"`.
- `features/payment-method/SelectMethodView.test.tsx`.
- `features/payment-status/PaymentStatusView.tsx` — exibe `qrCodeText` (PIX) ou placeholder (cartão); `aria-live="polite"` no container de status; trata APPROVED/DECLINED/CANCELLED/EXPIRED.
- `features/payment-status/PaymentStatusView.test.tsx`.
- `features/payment-status/hooks/usePaymentPolling.ts` — polling 3 s, timeout 5 min, pausa quando `document.visibilityState === 'hidden'`, para ao desmontar.
- `features/payment-status/hooks/usePaymentPolling.test.ts`.
- `features/payment-status/lib/payment-session.ts` — utilitário para idempotency key em `sessionStorage` por `orderId`.
- `features/order-confirmation/ConfirmationView.tsx` — busca tickets via `getOrderTickets` e renderiza `TicketList`.
- `features/order-confirmation/ConfirmationView.test.tsx`.
- `features/tickets/TicketList.tsx` — lista tickets com `aria-label={`Código do ingresso ${i+1}: ${code}`}`.
- `features/tickets/TicketList.test.tsx`.

### Checkout page (modificado)
- `features/checkout/components/CheckoutPage.tsx` — máquina de estados completa:
  ```
  LOADING → verifica order status
    → TICKETS_ISSUED → CONFIRMED
    → PAID → busca tickets → CONFIRMED
    → PENDING_PAYMENT → GET latest attempt
      → sem attempt → SELECTING_METHOD
      → PENDING/PROCESSING → PIX_WAITING | CARD_WAITING
      → DECLINED/CANCELLED/EXPIRED → PAYMENT_DECLINED | PAYMENT_EXPIRED
  ```
  - Token lido de `sessionStorage`; redirect para evento se ausente.
  - Idempotency key gerenciada por `payment-session.ts`.
  - Polling detecta APPROVED → CONFIRMED.
- `features/checkout/components/CheckoutPage.test.tsx`.

## Decisões

1. Aprovação inferida **exclusivamente** do polling de status no backend — nunca de callback do PSP.
2. Token de reserva nunca aparece na URL; lido de `sessionStorage`.
3. `qrCodeText` exibido como texto puro — QR visual fora do escopo desta task.
4. `exactOptionalPropertyTypes` requer spread condicional `{...(error != null ? { error } : {})}` em vez de `error={error ?? undefined}`.

## Testes

| Componente | Testes | Resultado |
|---|---|---|
| SelectMethodView | ✅ | — |
| PaymentStatusView | ✅ | — |
| usePaymentPolling | ✅ | — |
| ConfirmationView | ✅ | — |
| TicketList | ✅ | — |
| CheckoutPage | ✅ | — |
| **Total** | **60** | **✅** |
