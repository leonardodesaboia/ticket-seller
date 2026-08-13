# TASK-030 — Payment Attempt

## Status

DONE — MERGED em develop

## Objetivo

Criar a entidade `PaymentAttempt`, tabela, caso de uso e endpoint para iniciar uma tentativa de pagamento a partir de um order `PENDING_PAYMENT`.

## Dependências

TASK-029 integrada em develop.

## Propriedade exclusiva

- `apps/api/src/modules/payments/` (evolução — adicionar camada de aplicação e domínio)
- `apps/api/prisma/schema.prisma` — adicionar modelo `PaymentAttempt`
- `apps/api/prisma/migrations/20260812000010_payment_attempts/`

## Fora do escopo

Confirmação de pagamento, webhook, emissão de ticket, order PAID.

## Modelagem

### payment_attempts

```sql
payment_attempts:
- id                  UUID PK
- organization_id     UUID NOT NULL FK → organizations
- order_id            UUID NOT NULL FK → orders
- provider            VARCHAR(50) NOT NULL       -- 'FAKE'
- external_payment_id VARCHAR(255) NULL          -- preenchido após resposta do PSP
- status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
- payment_method      VARCHAR(50) NOT NULL       -- 'FAKE_PIX' | 'FAKE_CREDIT_CARD'
- amount              BIGINT NOT NULL
- currency            VARCHAR(3) NOT NULL
- idempotency_key     VARCHAR(255) UNIQUE NULL
- failure_code        VARCHAR(100) NULL
- checkout_data       JSONB NULL                 -- qrCode, clientToken — não sensível
- expires_at          TIMESTAMPTZ NOT NULL
- version             INT NOT NULL DEFAULT 1
- created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

CHECK: status IN ('PENDING','PROCESSING','APPROVED','DECLINED','CANCELLED','EXPIRED')
UNIQUE INDEX: idempotency_key (quando não null)
UNIQUE INDEX: external_payment_id (quando não null — usar partial index)
INDEX: (order_id)
INDEX: (organization_id)
INDEX: (status)
INDEX: (expires_at)
```

Não armazenar:
- PAN completo
- CVV
- senha
- dados sensíveis do cartão

## Módulo — novos arquivos dentro de `payments/`

```
payments/
  domain/
    payment-attempt.entity.ts
    payment-attempt.errors.ts
    ports/
      payment-attempt-repository.port.ts
  application/
    use-cases/
      create-payment-attempt.use-case.ts
      get-payment-attempt.use-case.ts
    ports/
      order-access.port.ts           — busca order + valida token
  infrastructure/
    repositories/
      prisma-payment-attempt.repository.ts
    adapters/
      order-access.adapter.ts
    payments.infrastructure.module.ts (evolução)
  presentation/
    controllers/
      public-payments.controller.ts
    dto/
      create-payment-attempt.dto.ts
      payment-attempt.response.ts
  payments.module.ts (evolução)
```

## Contratos

### Criar tentativa de pagamento

```
POST /api/v1/public/orders/:orderId/payments
Headers:
  X-Reservation-Token: <token hex 64>
  Idempotency-Key: <uuid v4>
  Content-Type: application/json

Body:
{
  "paymentMethod": "FAKE_PIX"   | "FAKE_CREDIT_CARD"
}

Response 201:
{
  "paymentAttemptId": "uuid",
  "orderId": "uuid",
  "provider": "FAKE",
  "status": "PENDING",
  "paymentMethod": "FAKE_PIX",
  "amount": 10000,
  "currency": "BRL",
  "expiresAt": "ISO8601",
  "checkoutData": {
    "type": "PIX",
    "qrCode": "...",
    "qrCodeText": "..."
  }
}
```

### Consultar última tentativa

```
GET /api/v1/public/orders/:orderId/payments/latest
Headers:
  X-Reservation-Token: <token>

Response 200: mesmo shape sem checkoutData (retornar null após aprovação)
Response 404: nenhuma tentativa encontrada
```

## Erros RFC 9457

```
400 INVALID_PAYMENT_METHOD       — método não suportado
401 INVALID_RESERVATION_TOKEN
404 ORDER_NOT_FOUND
409 IDEMPOTENCY_CONFLICT
409 PAYMENT_ALREADY_ACTIVE       — tentativa PENDING/PROCESSING existente
410 ORDER_EXPIRED
422 ORDER_NOT_PENDING_PAYMENT    — order já PAID, CANCELLED etc.
422 ORDER_AMOUNT_ZERO            — totalAmount = 0 (fluxo gratuito futuro)
503 GATEWAY_ERROR                — falha no PSP (não expor detalhes internos)
```

## Regras

- Validar token via hash (igual ao orders module)
- Order deve estar `PENDING_PAYMENT` e não expirado
- Amount vem exclusivamente de `order.totalAmount`
- Currency vem exclusivamente de `order.currency`
- Não permitir nova tentativa quando houver PENDING ou PROCESSING ativa (retornar 409 PAYMENT_ALREADY_ACTIVE)
- Depois de DECLINED/CANCELLED/EXPIRED, nova tentativa é permitida
- Idempotência: mesma key + mesmo payload → retorna attempt original
- Propagar idempotencyKey ao FakeGateway

## Fluxo transacional

```
1. Validar token (hash)
2. Validar Idempotency-Key
3. Buscar order (FOR UPDATE) — valida status e expiração
4. Verificar PAYMENT_ALREADY_ACTIVE
5. Criar PaymentAttempt com status PENDING
6. Chamar gateway.createPayment (fora do lock — chamada de rede)
7. UPDATE payment_attempts SET external_payment_id, status, checkout_data (operação rápida)
8. Emitir outbox payment.created.v1
9. Retornar attempt
```

Nota: gateway.createPayment ocorre **fora** de transação de banco longa.
Caso o processo caia após chamar o PSP mas antes de persistir: na próxima tentativa (mesmo idempotency_key), o attempt já existe e retorna idempotente; o PSP também é idempotente pela mesma key.

## Outbox

- `payment.created.v1`

## Testes obrigatórios

### Unitários

- attempt criado com amount do order (não do body)
- currency do order
- token inválido → erro
- status PENDING ao criar

### Integração (PostgreSQL real)

- criação válida FAKE_PIX → 201 com checkoutData PIX
- criação válida FAKE_CREDIT_CARD → 201 com checkoutData CREDIT_CARD
- order inexistente → 404
- order PAID → 422
- order expirado → 410
- token inválido → 401
- método inválido → 400
- idempotência: mesma key + mesmo payload → 201 com attempt original
- idempotência: mesma key + payload diferente → 409
- PAYMENT_ALREADY_ACTIVE: tentativa PENDING existente → 409
- após DECLINED: nova tentativa permitida
- amount = order.totalAmount (não pode vir do body)
- nenhum dado sensível na resposta ou no banco

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```
