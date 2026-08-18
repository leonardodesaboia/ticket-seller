Relatório da TASK-050 — Payout Provider & Split Foundation
Status

COMPLETED

Arquivos alterados
apps/api/prisma/migrations/20260818000028_payout_recipients/migration.sql: NOVO — payout_recipients com UNIQUE(organization_id), status CHECK
apps/api/prisma/schema.prisma: adicionado modelo PayoutRecipient
apps/api/src/modules/finance/domain/entities/payout-recipient.entity.ts: NOVO
apps/api/src/modules/finance/domain/ports/payout-gateway.port.ts: NOVO — IPayoutGatewayPort com PAYOUT_GATEWAY_PORT token, independente de IPaymentGatewayPort
apps/api/src/modules/finance/domain/ports/payout-recipient.repository.port.ts: NOVO
apps/api/src/modules/finance/infrastructure/adapters/fake/fake-payout.gateway.ts: NOVO — HMAC-SHA256 + timingSafeEqual, IDs determinísticos via sha256 (crypto nativo)
apps/api/src/modules/finance/infrastructure/adapters/fake/fake-payout.gateway.spec.ts: NOVO — 21 testes unitários
apps/api/src/modules/finance/infrastructure/repositories/prisma-payout-recipient.repository.ts: NOVO — findOrCreate atômico
apps/api/src/modules/finance/application/use-cases/register-payout-recipient.use-case.ts: NOVO — idempotente (retorna existente)
apps/api/src/modules/finance/presentation/controllers/finance.controller.ts: EXPANDIDO — POST /finance/recipient
apps/api/src/modules/finance/finance.module.ts: EXPANDIDO
apps/api/src/platform/config/env.ts: EXPANDIDO — FAKE_PAYOUT_SECRET no schema Zod

Implementado
PayoutGatewayPort completamente independente de PaymentGatewayPort (tokens e interfaces distintos).
FakePayoutGateway com HMAC-SHA256 + timingSafeEqual — secreto via env, nunca hardcoded.
externalPayoutId = 'fake_payout_' + sha256hex(idempotencyKey).slice(0, 24) — determinístico.
externalRecipientId = 'fake_recipient_' + sha256hex(organizationId).slice(0, 24) — determinístico.
FakeGateway auto-marca recipient como VERIFIED (KYC simulado).
findOrCreate atômico via INSERT ON CONFLICT DO NOTHING + SELECT — sem duplicatas em race conditions.
POST /organizations/:orgId/finance/recipient idempotente: retorna existente se já cadastrado.
FAKE_PAYOUT_SECRET: opcional em development (default dev-payout-secret), validado no construtor em production.

Decisões tomadas
FAKE_PAYOUT_SECRET marcado como optional() no Zod mas validado condicionalmente no construtor — production lança erro; development usa default com aviso nos logs.
getPayoutStatus usa mapa em memória por instância — adequado para dev/testes; status real via webhook.
findOrCreate em duas etapas SQL (INSERT + SELECT) — garante idempotência em race conditions.
UnauthorizedException do NestJS usado em camada de infrastructure/adapter para erro de assinatura inválida.

Testes executados
Comando	Resultado
pnpm --filter @ticket-seller/api prisma validate	aprovado
pnpm --filter @ticket-seller/api typecheck	aprovado (0 erros)
pnpm --filter @ticket-seller/api lint	6 erros pré-existentes
pnpm --filter @ticket-seller/api test	285 testes passando; 21 novos em fake-payout.gateway.spec.ts

Riscos identificados
Nenhum.

Pendências
Nenhuma.

Documentação atualizada
Nenhuma (documentação de fase será atualizada na conclusão de TASK-052).

Próxima tarefa recomendada
TASK-051 — Payout Processing
