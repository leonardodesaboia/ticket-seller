# TASK-029 — Payment Port & Gateway Adapter

## Status

DONE — MERGED em develop

## Objetivo

Criar a abstração oficial de pagamentos da plataforma (`PaymentGatewayPort`) e o adapter sandbox `FakePaymentGateway`.

Nenhuma integração com PSP real nesta task. O provider real será adicionado no futuro implementando o mesmo port.

## Dependências

TASK-028 integrada em develop. Contratos de TASK-025/026/027/028 FROZEN.

## Propriedade exclusiva

- `apps/api/src/modules/payments/` (módulo novo — criar tudo aqui)

## Fora do escopo

- Tabelas de banco (sem migration nesta task)
- PaymentAttempt entity/use-case
- Webhooks
- Emissão de ticket
- PSP real

## Módulo hexagonal

```
apps/api/src/modules/payments/
  domain/
    ports/
      payment-gateway.port.ts        — PaymentGatewayPort interface (TypeScript puro)
    payment-gateway.errors.ts        — GatewayError, GatewayTimeoutError, WebhookSignatureError
  infrastructure/
    adapters/
      fake/
        fake-payment.gateway.ts      — FakePaymentGateway implements PaymentGatewayPort
        fake-payment.gateway.spec.ts — testes unitários
    payments.infrastructure.module.ts
  payments.module.ts
```

## PaymentGatewayPort

```typescript
// domain/ports/payment-gateway.port.ts

export type PaymentProvider = 'FAKE';
export type PaymentMethod = 'FAKE_PIX' | 'FAKE_CREDIT_CARD';

export type InternalPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentWebhookEventType =
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_EXPIRED';

export interface CreatePaymentInput {
  idempotencyKey: string;
  orderId: string;
  organizationId: string;
  amount: bigint;         // minor units
  currency: string;       // 'BRL'
  paymentMethod: PaymentMethod;
  description: string;
}

export interface FakePixData {
  type: 'PIX';
  qrCode: string;
  qrCodeText: string;
}

export interface FakeCreditCardData {
  type: 'CREDIT_CARD';
  clientToken: string;
}

export interface CreatePaymentResult {
  externalPaymentId: string;
  status: InternalPaymentStatus;           // sempre PENDING na criação
  checkoutData: FakePixData | FakeCreditCardData | null;
  expiresAt: Date;
}

export interface PaymentWebhookInput {
  provider: PaymentProvider;
  rawBody: Buffer;
  signature: string;        // valor do header X-Fake-Signature
}

export interface ParsedPaymentWebhook {
  providerEventId: string;
  externalPaymentId: string;
  eventType: PaymentWebhookEventType;
  status: InternalPaymentStatus;
  amount: bigint;
  currency: string;
}

export interface PaymentGatewayPort {
  readonly provider: PaymentProvider;
  getSupportedMethods(): PaymentMethod[];
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(input: PaymentWebhookInput): Promise<ParsedPaymentWebhook>;
}

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');
```

## GatewayErrors

```typescript
// domain/payment-gateway.errors.ts

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class GatewayTimeoutError extends GatewayError {
  constructor() {
    super('Payment gateway timeout');
    this.name = 'GatewayTimeoutError';
  }
}

export class WebhookSignatureError extends GatewayError {
  constructor() {
    super('Invalid webhook signature');
    this.name = 'WebhookSignatureError';
  }
}
```

## FakePaymentGateway

Comportamento:
- `createPayment`:
  - Gera `externalPaymentId = 'fake_' + SHA256(idempotencyKey).slice(0, 32)` — determinístico para idempotência
  - FAKE_PIX: retorna qrCode e qrCodeText fictícios
  - FAKE_CREDIT_CARD: retorna clientToken fictício
  - expiresAt = agora + 15 minutos
  - Sempre retorna status `PENDING`
- `parseWebhook`:
  - Valida `X-Fake-Signature: sha256=<hex>` via `HMAC-SHA256(rawBody, FAKE_GATEWAY_SECRET)`
  - Lança `WebhookSignatureError` se inválida
  - Faz `crypto.timingSafeEqual` na comparação
  - Body JSON esperado: `{ eventId, externalPaymentId, eventType, amount, currency }`
  - Mapeia eventType para InternalPaymentStatus:
    - `PAYMENT_APPROVED` → `APPROVED`
    - `PAYMENT_DECLINED` → `DECLINED`
    - `PAYMENT_CANCELLED` → `CANCELLED`
    - `PAYMENT_EXPIRED` → `EXPIRED`
- `getSupportedMethods`: retorna `['FAKE_PIX', 'FAKE_CREDIT_CARD']`
- `provider`: `'FAKE'`

Configuração via env var:
- `FAKE_GATEWAY_SECRET`: obrigatória; se ausente, o adapter lança erro no construtor quando `NODE_ENV === 'production'`
- Em dev/test, aceitar valor default `'fake-secret-for-dev'` mas logar warning

## PaymentsModule

- Exporta `PAYMENT_GATEWAY_PORT` para uso por outros módulos
- Seleciona FakePaymentGateway por `FAKE_GATEWAY_SECRET` presente
- Única implementação por enquanto

## Testes obrigatórios (unitários)

Arquivo: `infrastructure/adapters/fake/fake-payment.gateway.spec.ts`

- `createPayment` retorna externalPaymentId determinístico para mesma idempotencyKey
- `createPayment` FAKE_PIX retorna FakePixData
- `createPayment` FAKE_CREDIT_CARD retorna FakeCreditCardData
- `createPayment` preserva amount e currency sem alteração
- `parseWebhook` assinatura válida → retorna ParsedPaymentWebhook
- `parseWebhook` assinatura inválida → lança WebhookSignatureError
- `parseWebhook` body malformado → lança GatewayError
- `parseWebhook` mapeia PAYMENT_APPROVED → APPROVED
- `parseWebhook` mapeia PAYMENT_DECLINED → DECLINED
- `parseWebhook` mapeia PAYMENT_CANCELLED → CANCELLED
- `parseWebhook` mapeia PAYMENT_EXPIRED → EXPIRED
- Secret não vaza em nenhuma resposta (verificar ausência em CreatePaymentResult)
- Construtor lança em production sem FAKE_GATEWAY_SECRET

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test  # unitários
pnpm build
```

## Formato de conclusão

1. arquivos criados/alterados
2. comportamento implementado
3. decisões tomadas
4. testes executados e resultados
5. riscos
6. pendências
7. documentação atualizada
