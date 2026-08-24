TASK-050 — Payout Provider & Split Foundation

Status: CONCLUÍDA

Objetivo

Criar a abstração `PayoutGatewayPort`, o `FakePayoutGateway` com validação HMAC-SHA256, a tabela `payout_recipients` e o endpoint de cadastro de recipient — isolado e independente do `PaymentGatewayPort`.

Resultado observável

- `PayoutGatewayPort` definido com métodos: createRecipient, createPayout, getPayoutStatus, parseWebhookEvent.
- `FakePayoutGateway` implementado com externalPayoutId determinístico e webhook HMAC-SHA256.
- Tabela `payout_recipients` criada.
- `POST /organizations/:orgId/finance/recipient` cria recipient para a organização.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-050-payout-provider.md
- docs/modules/payouts.md
- docs/modules/finance.md
- apps/api/src/modules/payments/domain/ports/payment-gateway.port.ts (referência de padrão)
- apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.ts (referência de padrão)
- apps/api/src/modules/finance/ (código existente)
- apps/api/prisma/schema.prisma (estado após TASK-049)

Arquivos permitidos

O agente pode criar ou alterar somente:
- apps/api/prisma/migrations/20260818000028_payout_recipients/migration.sql (NOVO)
- apps/api/prisma/schema.prisma (adicionar PayoutRecipient)
- apps/api/src/modules/finance/domain/ports/payout-gateway.port.ts (NOVO)
- apps/api/src/modules/finance/domain/entities/payout-recipient.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/ports/payout-recipient.repository.port.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/adapters/fake/fake-payout.gateway.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/repositories/prisma-payout-recipient.repository.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/register-payout-recipient.use-case.ts (NOVO)
- apps/api/src/modules/finance/presentation/controllers/finance.controller.ts (EXPANDIR — endpoint recipient)
- apps/api/src/modules/finance/finance.module.ts (EXPANDIR)
- apps/api/src/modules/finance/infrastructure/adapters/fake/fake-payout.gateway.spec.ts (NOVO)
- apps/api/test/integration/finance/payout-recipient.integration-spec.ts (NOVO)

Arquivos proibidos

- apps/api/src/modules/payments/ (não alterar PaymentGatewayPort existente)
- Migrations anteriores a 20260818
- pnpm-lock.yaml

Requisitos funcionais

1. `PayoutGatewayPort` com: provider: string, createRecipient, createPayout, getPayoutStatus, parseWebhookEvent.
2. `FakePayoutGateway`:
   - Token: `PAYOUT_GATEWAY_PORT = Symbol('PAYOUT_GATEWAY_PORT')`.
   - `externalPayoutId = 'fake_payout_' + sha256(idempotencyKey).slice(0, 24)`.
   - Webhook HMAC-SHA256 + timingSafeEqual com secret `FAKE_PAYOUT_SECRET`.
   - `createRecipient` retorna externalRecipientId determinístico baseado em orgId.
   - Status flow: PROCESSING → PAID via webhook.
3. `payout_recipients`: organization_id (UNIQUE), provider, external_recipient_id, status, metadata JSONB.
4. `POST /organizations/:orgId/finance/recipient` — ActorGuard (OWNER), cria ou retorna existente.
5. `FAKE_PAYOUT_SECRET` no schema Zod de env (obrigatório em production, opcional em development).
6. `PayoutGatewayPort` independente de `PaymentGatewayPort` — interfaces e tokens distintos.

Requisitos técnicos

- Seguir padrão idêntico ao FakePaymentGateway (timingSafeEqual, rawBody, HMAC-SHA256).
- Sem dependências de pacotes novas (crypto nativo Node.js).
- TypeScript strict.
- Testes unitários do FakePayoutGateway: assinatura válida, inválida, createRecipient, createPayout.

Invariantes

- Uma organização tem no máximo um recipient ativo (UNIQUE organization_id em payout_recipients).
- external_recipient_id não pode ser alterado após VERIFIED.
- FAKE_PAYOUT_SECRET nunca aparece em logs.

Segurança

- HMAC-SHA256 com timingSafeEqual em todo webhook de payout.
- Secret via env — nunca hardcoded.
- Dados de recipient (metadata) não expõem PII desnecessário em logs.
- Endpoint de recipient exige role OWNER.

Multi-tenancy

- payout_recipients.organization_id — consulta sempre com orgId do path.
- CrossTenant: verificar member da org no ActorGuard.

Concorrência

- ON CONFLICT DO NOTHING + SELECT no createRecipient (findOrCreate atômico).

Idempotência

- POST /finance/recipient: se já existe, retorna o existente sem criar duplicata.

Fora do escopo

- Processamento de payout (TASK-051).
- KYC real (FakeGateway marca como VERIFIED automaticamente).
- Múltiplos providers ativos.
- Alteração de recipient após criação (futura com controles de segurança adicionais).

Critérios de aceite

- PayoutGatewayPort definido e FakePayoutGateway implementado.
- Migration payout_recipients criada com UNIQUE(organization_id).
- FAKE_PAYOUT_SECRET no env schema.
- POST /finance/recipient funcional.
- Testes unitários do FakePayoutGateway aprovados.
- pnpm lint, typecheck, test aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api prisma validate
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-051 — Payout Processing
