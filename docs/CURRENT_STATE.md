Estado atual

Última atualização: 2026-08-24 (TASK-060 concluída; TASK-061 a TASK-062 planejadas)

Fase

Produção — EM ANDAMENTO. Módulo financeiro — CONCLUÍDA.

Objetivo da fase

Implementar autenticação real, membros e roles, administração de plataforma, uploads de mídia, rate limiting, observabilidade, hardening de segurança, infraestrutura de produção, backup e release readiness.

Decisões arquiteturais desta fase (ver ADRs)
- ADR-007: Auth próprio com email + senha, argon2id, JWT (access 15min + refresh 30d em cookie HttpOnly), refresh token rotation, JwtActorAdapter.
- ADR-008: IObjectStoragePort com MinioObjectStorageAdapter (dev) e S3ObjectStorageAdapter (prod); ResendEmailAdapter para email transacional em production.
- ADR-009: Dockerfiles multi-stage portáveis, sem acoplamento a cloud provider específica.

Implementado
diretórios iniciais;
documentação básica;
regras globais para agentes;
estrutura de tarefas;
definição inicial do produto;
definição arquitetural inicial;
monorepo inicializado com pnpm 11.17.0, Turborepo 2.10.7 e Node.js 22.18.0;
TypeScript 5.9.3, ESLint 10.8.0 e Prettier 3.9.6 configurados no workspace.
Em andamento

TASK-061 — Backup, Disaster Recovery & Operational Runbooks (próxima a implementar)

Próxima fase

Infraestrutura de produção, backup e release readiness (TASK-060 a TASK-062).

Próximas tarefas
TASK-001 — Fundação do repositório. (CONCLUÍDA)
TASK-002 — Bootstrap do monorepo. (CONCLUÍDA)
TASK-003 — Padronização de ferramentas. (CONCLUÍDA)
TASK-004 — API Bootstrap. (CONCLUÍDA)
TASK-005 — Infraestrutura local. (CONCLUÍDA)
TASK-006 — Marketplace Web Bootstrap. (CONCLUÍDA)
TASK-007 — Application Structure Standards. (CONCLUÍDA)
TASK-008 — Database Foundation. (CONCLUÍDA)
TASK-009 — Backoffice Web Bootstrap. (CONCLUÍDA)
TASK-010 — Continuous Integration. (CONCLUÍDA)
TASK-011 — Actor Foundation. (CONCLUÍDA)
TASK-012 — CreateOrganization. (CONCLUÍDA)
TASK-013 — CreateEvent + GetEvent. (CONCLUÍDA)
TASK-014 — Backoffice UI. (CONCLUÍDA)
TASK-015 — ListOrganizationEvents + ParseUUIDPipe. (CONCLUÍDA)
TASK-016 — UpdateEvent com controle de concorrência. (CONCLUÍDA)
TASK-017 — Event Management Backoffice. (CONCLUÍDA)
TASK-018 — Event Schedule, Venue e Currency Foundation. (CONCLUÍDA)
TASK-019 — Ticket Types Foundation. (CONCLUÍDA)
TASK-020 — Event Configuration Backoffice. (CONCLUÍDA)
TASK-021 — Publication Readiness. (CONCLUÍDA)
TASK-022 — Event Publication. (CONCLUÍDA)
TASK-023 — Public Event Catalog API. (CONCLUÍDA)
TASK-024 — Publish Flow + Marketplace Event Page. (CONCLUÍDA)
TASK-025 — Inventory Foundation. (CONCLUÍDA)
TASK-026 — Reservation Holds. (CONCLUÍDA)
TASK-027 — Order Foundation. (CONCLUÍDA)
TASK-028 — Marketplace Reservation Checkout Preparation. (CONCLUÍDA)
TASK-029 — Payment Port & Gateway Adapter. (CONCLUÍDA)
TASK-030 — Payment Attempt. (CONCLUÍDA)
TASK-031 — Payment Webhooks & Order Confirmation. (CONCLUÍDA)
TASK-032 — Ticket Issuance. (CONCLUÍDA)
TASK-033 — Checkout Payment UI. (CONCLUÍDA)
TASK-034 — Ticket Credential & QR Foundation. (CONCLUÍDA)
TASK-035 — Ticket Validation & Admission Engine. (CONCLUÍDA)
TASK-036 — Check-in API & Audit Trail. (CONCLUÍDA)
TASK-037 — Check-in Operator Interface. (CONCLUÍDA)
TASK-038 — Ticket Transfer Foundation. (CONCLUÍDA)
TASK-039 — Ticket Transfer Experience. (CONCLUÍDA)
TASK-040 — Event Attendance & Operations Dashboard. (CONCLUÍDA)
TASK-041 — Order & Ticket Cancellation Foundation. (CONCLUÍDA)
TASK-042 — Refund Processing. (CONCLUÍDA)
TASK-043 — Event Cancellation & Mass Refunds. (CONCLUÍDA)
TASK-044 — Chargebacks & Payment Disputes. (CONCLUÍDA)
TASK-045 — Notification Foundation. (CONCLUÍDA)
TASK-046 — Transactional Notifications. (CONCLUÍDA)
TASK-047 — Pricing & Platform Fees. (CONCLUÍDA)
TASK-048 — Financial Ledger double-entry. (CONCLUÍDA)
TASK-049 — Merchant Balance & Settlement. (CONCLUÍDA)
TASK-050 — Payout Provider & Split Foundation. (CONCLUÍDA)
TASK-051 — Payout Processing. (CONCLUÍDA)
TASK-052 — Financial Dashboard & Reconciliation. (CONCLUÍDA)
TASK-053 — Production Authentication & Sessions. (CONCLUÍDA)
TASK-054 — Organization Members, Roles & Permissions. (CONCLUÍDA)
TASK-055 — Platform Administration. (CONCLUÍDA)
TASK-056 — Media & Uploads Foundation. (CONCLUÍDA)
TASK-057 — Rate Limiting, Abuse Prevention & API Hardening. (CONCLUÍDA)
TASK-058 — Observability, Reliability & Operational Alerts. (CONCLUÍDA)
TASK-059 — Security Hardening & Data Protection. (CONCLUÍDA)
TASK-060 — Production Infrastructure & Deployment. (CONCLUÍDA)
TASK-061 — Backup, Disaster Recovery & Operational Runbooks. (PLANEJADA)
TASK-062 — Release Readiness & E2E Certification. (PLANEJADA)
Decisões confirmadas
monólito modular;
arquitetura hexagonal;
TypeScript;
PostgreSQL;
Redis não será fonte oficial de estoque;
integrações externas por adapters;
pagamento agnóstico via PaymentGatewayPort;
FakePaymentGateway antes do provider real;
MVP para até 100 usuários ativos simultaneamente;
evolução por escalabilidade horizontal;
microserviços não serão utilizados no MVP;
order só passa para PAID via webhook server-to-server validado criptograficamente;
ledger financeiro double-entry, append-only (nunca UPDATE/DELETE em ledger_entries);
valores financeiros sempre em minor units (BIGINT) — nunca float;
saldo materializado em seller_balances (pode ser negativo em pending/available — D10);
settlement_delay_days lido de fee_policies, nunca de variável de ambiente;
payout provider abstrato via PayoutGatewayPort (independente de PaymentGatewayPort);
FakePayoutGateway com HMAC-SHA256 + timingSafeEqual;
SELECT FOR UPDATE em seller_balances para serializar payouts concorrentes;
divergência de reconciliação vai para outbox — nunca corrige ledger silenciosamente;
auth própria com argon2id, JWT e refresh token rotation (ADR-007);
IObjectStoragePort com MinIO (dev) e S3 (prod); ResendEmailAdapter para email em production (ADR-008);
Dockerfiles multi-stage portáveis sem acoplamento a cloud provider (ADR-009);
MFA (TOTP) adiado para pós-MVP;
cloud target de produção não definido — Dockerfiles portáveis garantem flexibilidade.
