Estado atual

Última atualização: 2026-08-12 (TASK-033)

Fase

Pagamentos, confirmação de pedido e emissão de ingressos (MVP completo).

Objetivo da fase

Implementar o fluxo de ponta a ponta: seleção de método de pagamento → webhook de confirmação → emissão de ingressos → visualização no marketplace.

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

Nenhuma tarefa em andamento.

Próxima fase

Workers assíncronos, notificações por e-mail, check-in e provider real de pagamento.

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
inventory transita de reserved para committed apenas na confirmação de pagamento;
tickets só são emitidos a partir de order efetivamente PAID;
emissão de tickets ocorre na mesma transação de confirmação do webhook;
rawBody: true no Fastify para preservar corpo bruto do webhook;
idempotência ponta a ponta: UNIQUE constraints + ON CONFLICT DO NOTHING + FOR UPDATE.
Decisões pendentes
nome comercial;
provedor real de pagamentos;
provedor de autenticação;
provedor de e-mail;
fila inicial;
nuvem inicial;
política de split;
prazo de repasse.
Problemas conhecidos

Nenhum problema técnico registrado.

Fora do escopo atual
reembolso;
chargeback;
check-in;
PDF de ingresso;
QR Code visual;
transferência de ingresso;
workers assíncronos;
notificações;
módulo finance;
integração real com PSP;
aplicação nativa;
Kubernetes;
microserviços;
multi-cloud ativa.

## Implementado

- fundação documental para desenvolvimento com IA;
- regras globais em AGENTS.md;
- workflows PLAN, IMPLEMENT, REVIEW e FIX;
- templates de tarefas, ADRs e relatórios;
- documentação inicial dos módulos do domínio;
- monorepo inicializado: package.json, pnpm-workspace.yaml, turbo.json, .npmrc, .node-version, .nvmrc, pnpm-lock.yaml;
- ferramentas padronizadas: TypeScript 5.9.3 (strict), ESLint 10.8.0 (flat config), Prettier 3.9.6, packages/tsconfig/ compartilhado, Turborepo 2.10.7;
- runtime: Node.js 22.18.0 LTS, pnpm 11.17.0;
- API backend: NestJS 10.4.22 + Fastify 4.29.1 em apps/api/ — GET /api/v1/health/live e /ready, RFC 9457 errors, Pino logging (nestjs-pino 3.5.0), Swagger (@nestjs/swagger 7.4.0);
- infraestrutura local: Docker Compose com PostgreSQL 17-alpine, Redis 7-alpine, MinIO latest, Mailpit latest;
- web pública: Next.js 15.5.22 + React 19.2.8 + App Router + Tailwind CSS 4 + shadcn/ui em apps/marketplace-web/;
- arquitetura de pastas: platform/ na API, feature-first + shared/ nos frontends, design tokens em packages/design-tokens/;
- design tokens: pacote @ticket-seller/design-tokens com tokens semânticos HSL + @theme inline no marketplace;
- banco de dados: Prisma 5.22.0 + PostgreSQL — PrismaService @Global, DatabaseModule, DATABASE_URL validado por Zod, 3 migrations (users, organizations, infrastructure), GET /ready verifica banco real, testes de integração com Testcontainers (5/5 passando);
- backoffice: Next.js 15 + App Router + Tailwind CSS 4 + design tokens em apps/backoffice-web/ (porta 3002), estrutura shared/ idêntica ao marketplace, Button primitivo com tokens semânticos, cliente de API centralizado;
- CI: GitHub Actions em .github/workflows/ci.yml — 4 jobs paralelos (quality, test, build, validate), Testcontainers para integração, concorrência com cancel-in-progress, permissões mínimas;
- actor foundation: IActorAdapter port, DevelopmentActorAdapter (lê X-Dev-User-Id, desabilitado em production), ActorGuard, CurrentActor decorator — TASK-011;
- CreateOrganization: POST /api/v1/organizations, módulo hexagonal completo (domain, application, infrastructure, presentation), criação atômica via $transaction (org + OWNER member + outbox event), 6 testes de integração — TASK-012;
- backoffice features: organizations/new, organizations/[id]/events/new, organizations/[id]/events/[id] com TanStack Query, React Hook Form + Zod — TASK-014;
- CreateEvent + GetEvent: POST e GET /api/v1/organizations/:organizationId/events/:eventId, módulo hexagonal completo com IOrganizationAccessPort port, role check (OWNER/ADMIN/EVENT_MANAGER para criar), evento nasce como DRAFT, outbox event.created.v1 atômico, 11 testes de integração — TASK-013;
- backoffice UI completa: organizations/new, events/new, events/[id] com TanStack Query, React Hook Form + Zod, design tokens — TASK-014;
- ListOrganizationEvents: GET /api/v1/organizations/:orgId/events com paginação keyset (createdAt DESC + id DESC), cursor base64url, ParseUUIDPipe em todos os parâmetros UUID, Fastify adapter corrigido nos testes de integração — TASK-015;
- UpdateEvent: PATCH /api/v1/organizations/:orgId/events/:eventId, coluna version INTEGER (migration 20260729000002_event_version), optimistic locking via updateMany WHERE version=N, 409 Conflict + 422 UnprocessableEntity + 403 Forbidden, outbox event.updated.v1 atômico com changedFields — TASK-016;
- backoffice event management: listagem paginada /organizations/[id]/events, formulário de edição /organizations/[id]/events/[id]/edit com detecção de conflito 409 — TASK-017;
- event schedule/venue/currency: migration events (format, startsAt, endsAt, timezone, onlineInfo, venueId, currency), módulo venues (POST/GET), PATCH /events/:id/configuration com optimistic lock, outbox, cross-module IVenueAccessPort — TASK-018;
- ticket types: migration ticket_types, domínio dentro de events/domain/ticket-types/, POST/GET/PATCH com idempotência scoped (orgId:eventId:key), deactivation via status=INACTIVE, currency lock (422 quando há ingressos ativos) — TASK-019;
- backoffice configuração: VenueSelect com criação inline, TicketTypeList com deactivation + version conflict, EventConfigurationForm com campos condicionais por formato, página /configuration integrada, utilitário money.ts (toMinorUnits/toDisplayValue) — TASK-020.
- publication readiness: PublicationReadinessPolicy pura (20 códigos estáveis), GET /events/:id/publication-readiness administrativo, snapshot com onlineConfigured (nunca onlineInfo) — TASK-021.
- event publication: POST /events/:id/publish, transição atômica e idempotente DRAFT → PUBLISHED com readiness recalculada sob lock, slug global imutável + publishedAt, outbox event.published.v1, auditoria event.published (primeiro uso de audit_entries), campos Event.slug/publishedAt aditivos, migration 005 com constraint events_published_fields_check e índice parcial de eventos publicados — TASK-022 (integrada em develop, commit 26a0a72).
- catálogo público: GET /api/v1/public/events (listagem keyset startsAt ASC, id ASC, cursor opaco, PUBLISHED em andamento/futuros) e GET /api/v1/public/events/:slug (detalhe PUBLISHED, acessível após término), sem autenticação, DTOs públicos independentes (evento/venue público/ticket types ativos por preço), onlineInfo/endereço/IDs/capacidade nunca expostos, 404 indistinguível, Cache-Control public max-age=60 swr=300 — TASK-023 (integrada em develop, commit c87914d).
- marketplace público (Server Components): home lista publicados + /events/[slug] com generateMetadata/canonical, notFound/loading, cliente público tipado, moeda BRL e formatação de datas/formato, sem dados privados; backoffice publish flow: checklist de readiness (códigos do backend + links por seção + fallback) e publicação com chave idempotente estável, guarda de duplo clique, 409/422/rede, invalidação de cache e confirmação acessível — TASK-024.
- inventory foundation: tabela ticket_inventory com SQL atômico para tryReserve (UPDATE WHERE disponível > 0 RETURNING *), módulo hexagonal inventory/, available calculado lazy via JOIN, 13 testes unitários + 28 testes de integração (2 concorrência) — TASK-025.
- reservation holds: tabela reservations + reservation_items com expiração, continuationTokenHash (SHA-256 armazenado), POST /api/v1/public/events/:slug/reserve, cancel automático por token hash, idempotência, outbox reservation.created.v1 e reservation.cancelled.v1 — TASK-026.
- order foundation: tabelas orders + order_items + idempotency_records + outbox_events completo, POST /api/v1/public/reservations/:id/order idempotente, token de reserva válido, reservation CONSUMED ao criar order, totalAmount calculado do inventário — TASK-027.
- marketplace checkout preparation: página /checkout/[reservationId] com countdown de reserva, recuperação de token via sessionStorage, skeleton de seleção de assentos, integração completa com o fluxo de reserva → checkout — TASK-028.
- payment gateway port: PaymentGatewayPort agnóstica de PSP, FakePaymentGateway com externalPaymentId determinístico (SHA-256 da idempotency key), validação HMAC-SHA256 com timingSafeEqual, 17 testes unitários — TASK-029.
- payment attempt: tabela payment_attempts, entidade com isActive/isTerminal, CreatePaymentAttempt (amount do order, nunca do body), GetLatestPaymentAttempt, endpoints POST e GET /public/orders/:orderId/payments, 10 testes unitários + 11 integração — TASK-030.
- payment webhooks e confirmação de order: tabela payment_webhook_events, ProcessPaymentWebhookUseCase com FOR UPDATE + ON CONFLICT DO NOTHING, validação de amount/currency, transição PENDING_PAYMENT → PAID atômica com commit de inventory e outbox, rawBody: true no Fastify, 7 testes unitários + 9 integração (1 concorrência) — TASK-031.
- ticket issuance: tabela tickets com UNIQUE(order_item_id, unit_index), IssueTicketsUseCase dentro da transação de webhook APPROVED (PAID → tickets → TICKETS_ISSUED), public_code = 64 chars hex aleatório, GET /public/orders/:orderId/tickets com token de reserva, 8 testes unitários + 9 integração (1 concorrência) — TASK-032.
- checkout payment UI: public-payments.api.ts tipado, SelectMethodView (PIX/Cartão + aria), usePaymentPolling (3s, 5min timeout, visibility-aware), PaymentStatusView (qrCodeText PIX ou placeholder cartão), ConfirmationView + TicketList (aria-labels), CheckoutPage com máquina de estados completa (LOADING → SELECTING_METHOD → PIX/CARD_WAITING → CONFIRMED), aprovação inferida apenas do polling de status no backend, 60 testes unitários — TASK-033.
