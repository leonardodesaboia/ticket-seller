# TASK-033 — Checkout Payment UI

## Status

DONE — MERGED em develop

## Objetivo

Implementar o fluxo de pagamento completo no marketplace: seleção de método, exibição de instruções PIX/cartão, polling do status, confirmação do order PAID e visualização dos tickets emitidos.

## Dependências

TASK-029 a TASK-032 integradas em develop. Contratos FROZEN.

## Propriedade exclusiva

- `apps/marketplace-web/src/features/payment-method/`
- `apps/marketplace-web/src/features/payment-status/`
- `apps/marketplace-web/src/features/order-confirmation/`
- `apps/marketplace-web/src/features/tickets/`
- `apps/marketplace-web/src/features/checkout/` (evolução — integrar pagamento)
- `apps/marketplace-web/src/shared/api/public-payments.api.ts` (novo)
- `apps/marketplace-web/src/app/checkout/[reservationId]/` (evolução)

## Fora do escopo

Forma de pagamento por cartão real com dados sensíveis, QR visual real (Fake retorna texto), check-in, PDF, transferência.

## Features

### payment-method/

Componente de seleção de método de pagamento:
- Buscar métodos disponíveis do backend (`getSupportedMethods` exposto via endpoint ou hard-coded para Fake: PIX e Cartão)
- Para MVP/Fake: mostrar apenas FAKE_PIX e FAKE_CREDIT_CARD com labels legíveis
- Botão "Pagar" que cria PaymentAttempt
- Estados: idle, criando, erro
- Idempotency-Key estável por tentativa (reutilizar em retry; nova key somente em nova tentativa lógica)
- Duplo clique protegido por loading state

### payment-status/

Exibição das instruções após criação da tentativa:
- FAKE_PIX: mostrar qrCodeText (código copia e cola), valor, expiração
- FAKE_CREDIT_CARD: mostrar clientToken fictício (UI placeholder)
- Polling do status a cada 3 segundos (máximo 5 minutos)
- Ao detectar status APPROVED: redirecionar para `/checkout/[reservationId]?confirmed=true`
- Ao detectar DECLINED/CANCELLED/EXPIRED: mostrar mensagem, permitir nova tentativa
- Não inferir aprovação por callback do "PSP" — apenas por GET do status

### order-confirmation/

Exibição após order PAID:
- Evento, itens, quantidade, preço, subtotal, total, moeda
- Tickets emitidos (GET /orders/:orderId/tickets)
- Para cada ticket: publicCode (texto), status
- Mensagem de confirmação clara

### tickets/

Componente de listagem de tickets:
- Lista de tickets com publicCode, orderItem, status
- Não implementar QR visual (TASK-032 gera apenas código texto)
- Acessibilidade: cada publicCode com aria-label descritivo

## API client

```typescript
// shared/api/public-payments.api.ts

createPaymentAttempt(orderId, token, idempotencyKey, method): Promise<PaymentAttemptResponse>
getLatestPaymentAttempt(orderId, token): Promise<PaymentAttemptResponse | null>
getOrderTickets(orderId, token): Promise<TicketsResponse>
```

## Checkout page — fluxo completo

```
Página /checkout/[reservationId]
  → recuperar token do sessionStorage
  → GET reservation (verificar expiração)
  → GET ou POST order (idempotente)
  → se order TICKETS_ISSUED → ir direto para confirmation
  → se order PAID → buscar tickets → confirmation
  → se order PENDING_PAYMENT:
      → verificar se há attempt ativo (GET /orders/:id/payments/latest)
      → se não há: mostrar seleção de método
      → se há PENDING/PROCESSING: mostrar status + polling
      → se há DECLINED/CANCELLED/EXPIRED: mostrar mensagem + nova tentativa
```

## Persistência

- Token em `sessionStorage` (já implementado em TASK-028)
- Idempotency-Key da tentativa de pagamento: salvar em sessionStorage por orderId
  (`payment_idempotency_key_{orderId}`)
- Nova tentativa lógica: gerar nova key e salvar

## Polling

- Intervalo: 3 segundos
- Timeout: 5 minutos
- Após timeout: mostrar mensagem + opção de recarregar
- Não fazer polling quando página não está visível (`document.visibilityState`)
- Parar polling ao desmontar componente

## Estados da UI

```
SELECTING_METHOD       — escolher PIX ou Cartão
CREATING_PAYMENT       — loading após clicar Pagar
PIX_WAITING            — QR/código PIX exibido, aguardando polling
CARD_WAITING           — placeholder cartão, aguardando polling
PAYMENT_DECLINED       — exibir motivo + botão nova tentativa
PAYMENT_EXPIRED        — exibir mensagem + botão nova tentativa
ORDER_EXPIRED          — pedido expirou, link para evento
CONFIRMED              — order PAID, mostrar tickets
ERROR_CREATING         — erro ao criar tentativa, retry
LOADING                — estado inicial / carregando
```

## Acessibilidade

- `aria-live="polite"` no status do pagamento (atualização a cada ciclo de polling, não a cada segundo)
- `role="alert"` em erros
- Foco automático em erros
- `aria-label` em cada código de ingresso
- Loading states com `aria-busy`
- Botões disabled com contraste adequado
- QR code acompanhado de `aria-label` com texto alternativo

## Testes

```
- seleção de método FAKE_PIX → cria attempt → mostra código
- seleção de método FAKE_CREDIT_CARD → cria attempt → mostra placeholder
- polling detecta APPROVED → vai para confirmation
- polling detecta DECLINED → mostra erro + nova tentativa
- nova tentativa gera nova idempotency key
- duplo clique não duplica chamada
- idempotency key reutilizada em retry
- refresh página mantém contexto (sessionStorage)
- order TICKETS_ISSUED na chegada → vai direto para confirmation
- order PAID na chegada → busca tickets → confirmation
- tickets exibidos corretamente
- token ausente → redireciona para evento com mensagem
- order expirado → mensagem + link
- polling para após 5 minutos
- acessibilidade: aria-labels presentes
```

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
