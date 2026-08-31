# TASK-071 — Guard de amount/currency no ProcessPayoutWebhookUseCase

## Status

COMPLETED

## Objetivo

Corrigir a vulnerabilidade em `ProcessPayoutWebhookUseCase` onde `amount` e `currency`
provenientes do payload do webhook (fonte não confiável) são usados diretamente nas
operações financeiras (`decrementReserved`, ledger) em vez dos valores persistidos em
`payout.amount`/`payout.currency`. Um payload adulterado ou com bug no provider pode
corromper o saldo reservado.

## Resultado observável

- Webhook com `amount`/`currency` divergente do payout armazenado é rejeitado silenciosamente;
- um evento `'finance.webhook-mismatch.v1'` é inserido no `outbox_events` para auditoria;
- `handleSucceeded` e `handleFailed` sempre usam `payout.amount`/`payout.currency`;
- webhook com valores corretos continua funcionando normalmente;
- todos os testes passam.

## Contexto obrigatório

- `AGENTS.md`
- esta task
- `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.ts`
- `apps/api/src/modules/finance/domain/ports/payout-gateway.port.ts` — confirmar que `ParsedWebhookEvent.amount: bigint` é required
- `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts` — padrão de outbox insert e comparação de mismatch
- `apps/api/src/modules/finance/application/use-cases/create-payout.use-case.spec.ts` — padrão de mocks e estrutura do spec

## Arquivos permitidos

- `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.ts` — modificar
- `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.spec.ts` — criar
- `.ai/reports/TASK-071-webhook-payout-amount-guard.md` — criar ao concluir

## Arquivos proibidos

- qualquer migration Prisma ou `schema.prisma`;
- qualquer worker, controller, DTO de apresentação ou módulo;
- `reconciliation.worker.ts` — não alterar;
- qualquer outro use case ou entidade de domínio;
- `docs/CURRENT_STATE.md` (atualizar só se solicitado pelo usuário).

## Mudança exata no use case

### Localização do bug

`execute()`, linhas 77–81: `amount`/`currency` do evento são passados aos handlers.

```typescript
// BUG: usa event.amount/event.currency (não confiável)
await this.handleSucceeded(payout.id, organizationId, amount, currency, webhookEventData);
await this.handleFailed(payout.id, organizationId, amount, currency, failureReason, webhookEventData);
```

### Correção

Inserir o **Passo 4** entre o guard de status terminal (Passo 3) e o dispatch para os
handlers. O passo deve ser adicionado antes de `const { organizationId } = payout;`.

```typescript
// Step 4: Guard — reject webhook if amount/currency diverges from stored payout
if (event.amount !== payout.amount || event.currency !== payout.currency) {
  await this.transactionRunner.run(async (tx) => {
    type TxRaw = { $executeRaw: (...args: unknown[]) => Promise<number> };
    const txRaw = tx as TxRaw;
    await txRaw.$executeRaw`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, type, payload, organization_id)
      VALUES (
        'payout',
        ${payout.id}::uuid,
        'finance.webhook-mismatch.v1',
        ${JSON.stringify({
          payoutId: payout.id,
          organizationId: payout.organizationId,
          expectedAmount: payout.amount.toString(),
          actualAmount: event.amount.toString(),
          expectedCurrency: payout.currency,
          actualCurrency: event.currency,
          providerEventId,
        })}::jsonb,
        ${payout.organizationId}::uuid
      )
    `;
  });
  this.logger.warn(
    `Payout webhook mismatch for payout ${payout.id} — ` +
      `expected amount=${payout.amount} currency=${payout.currency}, ` +
      `got amount=${event.amount.toString()} currency=${event.currency} ` +
      `(event ${providerEventId}) — rejecting webhook`,
  );
  return;
}
```

Alterar as chamadas dos handlers para usar `payout.amount`/`payout.currency`:

```typescript
if (eventType === 'SUCCEEDED') {
  await this.handleSucceeded(payout.id, organizationId, payout.amount, payout.currency, webhookEventData);
} else {
  const failureReason = `Provider reported FAILED for event ${providerEventId}`;
  await this.handleFailed(payout.id, organizationId, payout.amount, payout.currency, failureReason, webhookEventData);
}
```

As assinaturas privadas de `handleSucceeded` e `handleFailed` **não mudam** — continuam
recebendo `amount: bigint, currency: string`. Apenas o call site muda de
`amount`/`currency` (do evento) para `payout.amount`/`payout.currency`.

## Distinção crítica: webhook vs reconciliation

| Aspecto | ReconciliationWorker | ProcessPayoutWebhookUseCase |
|---|---|---|
| Fonte do amount | Provider via polling (confiável) | Payload do webhook (não confiável) |
| Mismatch | Insere outbox, **continua** processando | Insere outbox, **rejeita** (return) |
| Razão | Polling é fonte autoritativa; mismatch é informacional | Webhook pode ser replay attack ou bug do provider |

## Spec a criar

Arquivo: `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.spec.ts`

### Padrão de mocks

Usar o mesmo padrão de `create-payout.use-case.spec.ts`:

```typescript
const makePayout = (overrides: Partial<Payout> = {}): Payout => ({
  id: 'payout-1',
  organizationId: 'org-1',
  recipientId: 'recipient-1',
  amount: 10000n,
  currency: 'BRL',
  status: 'PROCESSING',
  provider: 'fake',
  externalPayoutId: 'ext-payout-1',
  idempotencyKey: 'idem-key-1',
  failureReason: null,
  requestedAt: new Date('2026-01-01T00:00:00Z'),
  succeededAt: null,
  failedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeEvent = (overrides: Partial<ParsedWebhookEvent> = {}): ParsedWebhookEvent => ({
  provider: 'fake',
  providerEventId: 'evt-1',
  externalPayoutId: 'ext-payout-1',
  eventType: 'SUCCEEDED',
  amount: 10000n,
  currency: 'BRL',
  rawPayload: {},
  ...overrides,
});

const makeMockTx = () => ({
  $executeRaw: jest.fn().mockResolvedValue(1),
  $queryRaw: jest.fn().mockResolvedValue([{ status: 'PROCESSING' }]),
});
```

Tipos sem `any`/`unknown` explícitos:

```typescript
let transactionRunner: { run: jest.Mock<Promise<unknown>, [((tx: ReturnType<typeof makeMockTx>) => Promise<unknown>)]> };
let payoutRepo: jest.Mocked<Pick<IPayoutRepository, 'findByExternalId' | 'updateStatus'>>;
let balanceRepo: jest.Mocked<Pick<ISellerBalanceRepository, 'decrementReserved'>>;
let ledgerRepo: jest.Mocked<Pick<ILedgerRepository, 'findOrCreateOrgAccount' | 'findAccountByCode' | 'recordTransaction'>>;
let gateway: jest.Mocked<Pick<IPayoutGatewayPort, 'parseWebhookEvent'>>;
let logger: jest.Mocked<Pick<ILogger, 'log' | 'warn' | 'error'>>;
```

### Casos obrigatórios

**execute() — validação e guards:**

1. Payout não encontrado → lança `NotFoundError`.
2. Payout já `PAID` → retorna sem chamar handlers (idempotência por status externo).
3. Payout já `FAILED` → retorna sem chamar handlers.
4. `event.amount !== payout.amount` → insere outbox `'finance.webhook-mismatch.v1'`, loga warn, retorna; handlers **não** são chamados.
5. `event.currency !== payout.currency` → mesmo comportamento do caso 4.
6. `event.amount === payout.amount && event.currency === payout.currency` → prossegue sem inserir outbox.

**execute() — dispatch correto:**

7. `eventType === 'SUCCEEDED'` → chama `handleSucceeded` com `payout.amount`/`payout.currency` (não os do evento).
8. `eventType === 'FAILED'` → chama `handleFailed` com `payout.amount`/`payout.currency`.

**handleSucceeded:**

9. Dedup: `$executeRaw` retorna `0` → retorna sem nenhuma mutação de saldo ou ledger.
10. Re-check terminal sob lock: status `PAID` → sem mutação.
11. Re-check terminal sob lock: status `FAILED` → sem mutação.
12. Happy path: `updateStatus('PAID')`, `decrementReserved(organizationId, payout.amount)`, `recordTransaction` com `amount: payout.amount, currency: payout.currency`.

**handleFailed:**

13. Dedup: `$executeRaw` retorna `0` → retorna sem mutação.
14. Re-check terminal sob lock: status `FAILED` → sem mutação.
15. Happy path: `updateStatus('FAILED')`, `decrementReserved`, `$executeRaw` de restore de `available_amount`, `recordTransaction` com `amount: payout.amount, currency: payout.currency`.

### Estrutura do transactionRunner mock

```typescript
transactionRunner = {
  run: jest.fn().mockImplementation(
    (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<unknown>) => cb(makeMockTx()),
  ),
};
```

Para testar comportamentos distintos de `$executeRaw` dentro da transação (dedup vs outbox),
usar `mockImplementationOnce` com um `mockTx` capturado:

```typescript
const mockTx = makeMockTx();
mockTx.$executeRaw.mockResolvedValueOnce(0); // simula dedup: nenhuma linha inserida
transactionRunner.run.mockImplementationOnce(
  (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<unknown>) => cb(mockTx),
);
```

## Invariantes

- Nenhum valor financeiro (`amount`, `currency`) proveniente do webhook afeta o banco diretamente.
- `payout.amount`/`payout.currency` são a única fonte autoritativa para operações de saldo e ledger.
- O outbox insert do mismatch usa `transactionRunner.run` — mesma abstração dos handlers.
- Nenhum tipo `any` ou `unknown` explícito no spec file (usar `ReturnType<typeof makeMockTx>` e `jest.Mocked<Pick<...>>`).
- Nenhuma migration Prisma é necessária — `outbox_events` já existe.
- Ledger permanece append-only e auditável.
- Multi-tenancy preservado: `organization_id` sempre presente no outbox insert.

## Segurança

- O guard é a primeira linha de defesa contra replay attacks e bugs de provider que enviam
  valores errados no payload do webhook.
- Nenhuma credencial é logada; apenas `payoutId`, `amount` (bigint) e `currency` (string).

## Fora do escopo

- Alterar a assinatura de `ParsedWebhookEvent` (o campo `amount` já é required).
- Criar novo endpoint HTTP.
- Alterar a lógica de dedup por `provider_event_id` (já existente nos handlers).
- Alterar `ReconciliationWorker` (comportamento de mismatch é diferente por design).
- Integração com PSP real.

## Critérios de aceite

- `pnpm --filter @ticket-seller/api typecheck` aprovado (0 erros).
- `pnpm --filter @ticket-seller/api lint` aprovado.
- `pnpm --filter @ticket-seller/api test -- --runInBand` aprovado (todos os casos do spec passam).
- `bash .ai/scripts/validate-architecture.sh` aprovado.
- `grep -rn "as any\|: any\|as unknown\|: unknown" apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.spec.ts` → 0 resultados.

## Comandos

```bash
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api test -- --runInBand --testPathPattern="process-payout-webhook"
bash .ai/scripts/validate-architecture.sh
```

## Próxima tarefa

TASK-070 — Modelo financeiro único para taxas do comprador e produtor (independente desta task).
