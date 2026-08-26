Estado atual

Última atualização: 2026-08-26 (sessão 9 de correções concluída)

Fase

Pós-RC-1.0 — Correções de segurança e qualidade em andamento.

Objetivo da fase

Corrigir vulnerabilidades e bugs identificados na revisão de módulos pós-RC-1.0. Integrar autenticação real no backoffice (TASK-063).

Decisões arquiteturais desta fase (ver ADRs)
- ADR-007: Auth própria com email + senha, argon2id, JWT (access 15min + refresh 30d em cookie HttpOnly), refresh token rotation, JwtActorAdapter.
- ADR-008: IObjectStoragePort com MinioObjectStorageAdapter (dev) e S3ObjectStorageAdapter (prod); ResendEmailAdapter para email transacional em production.
- ADR-009: Dockerfiles multi-stage portáveis, sem acoplamento a cloud provider específica.

Implementado (pós-RC-1.0, commits 2026-08-25)

**Sessão 1 — commit 93bdf7a:**
- Revisão de todos os módulos da API: identity, organizations, events/venues, orders/reservations, payments/finance, tickets/checkin/inventory, notifications, media, platform-admin.
- Revisão de frontend: backoffice-web e marketplace-web (UI/UX + features).
- Correções de segurança: IDOR em refund, cancelamento de pedido, aceitação de convite, cancelamento de evento.
- Correções de concorrência: cancel() com FOR UPDATE e retry, inventory sem transação, requestHash sem idempotencyKey.
- Correções de arquitetura: IUserRepository (identity), IEventCoverRepository (media) — PrismaService removido da camada de aplicação.
- Correções de UI/UX: botão copiar PIX, hydration mismatch, labels de desenvolvimento expostos, ARIA.
- Correções de notificações: emails de alerta admin configuráveis via ADMIN_NOTIFICATION_EMAIL.
- Nova migration: orders.buyer_email.

**Sessão 2 — commits 6dfa5ea, 1f723e0, 238153f:**
- finance/process-payout-webhook: SELECT FOR UPDATE recheck em handleSucceeded/handleFailed.
- finance/settle-order: guard pending_amount >= sellerNetAmount.
- finance/settlement.worker + reconciliation.worker: flags isRunning, FOR UPDATE SKIP LOCKED.
- identity/reset-password: resetPasswordAtomically — markUsed + updateCredentialHash atômicos.
- identity/refresh-session: IP e UserAgent preservados na rotação de tokens.
- organizations/remove-member: CannotRemoveSelfError — auto-remoção bloqueada.
- organizations/invite-member: email normalizado (lowercase/trim).
- organizations/revoke-invitation: guard isUsed além de isRevoked.
- orders/reservation: isSerializationFailure captura 40P01 (deadlock).
- 440/440 testes passando.

**Sessão 3 — commit 67c3537:**
- identity: emailVerificationRepository.create com try/catch — falha logada como CRITICAL sem propagar 500.

**Sessão 4 — commits 8e7caa6, 45b7591:**
- organizations/M1: markInvitationUsed movido para dentro da transação com guard revokedAt.
- organizations/A1: update-member-role verifica ROLES_ASSIGN antes de promover a OWNER.
- organizations/A3: indexes compostos em OrganizationMember (organizationId+status, organizationId+role+status).
- finance/A2: record-chargeback distingue se pedido foi settled — decrementa pending vs available.
- identity/M4: forceReset lido do PasswordCredential no login; AuthenticateWithPasswordOutput inclui mustResetPassword.
- identity/M5: findActiveByTokenHash e findActiveById filtram revokedAt=null + expiresAt>=now no banco.
- identity/M6: resetPasswordAtomically via transaction array do Prisma.
- identity/M7: RefreshSessionInput aceita ip e userAgent.
- tickets/C2: findByIdempotencyKey em check-in filtra por organization_id — vazamento cross-tenant corrigido.
- tickets/A2: acceptAtomically com FOR UPDATE + verificação expires_at <= NOW() dentro da transação.
- tickets/A4: initializeForEvent envolto em $transaction.
- tickets/A5: findByTokenHash em ticket-credential recebe organizationId e filtra no banco.

**Sessão 5 — commit 8ae3ca0:**
- identity/A3: refresh-session envolve sessionRepository.create em try/catch — 503 em vez de 500.
- identity/A4: index @@index([ip, attemptedAt]) em AuthenticationAttempt para countRecentFailures.
- 445/445 testes passando.

**Sessão 6 — commits 7164194, 2468cc0:**
- frontend/BO-05: usePayouts e useTransactions com queryFn pura + useEffect para acúmulo de páginas.
- frontend/MK-04: retry com backoff em erros transientes no checkout.
- frontend/MK-05: tratamento de erro permanente sem retry infinito.
- organizations/M2: findPendingInvitationByEmail adicionado; invite revoga convite pendente antes de criar novo.

**Sessão 7 — commits 665761a, f2fd5ef, 29a781b:**
- organizations/M5: MEMBERS_VIEW capability adicionada a todos os roles — GET /members usa MEMBERS_VIEW.
- organizations/M6: DELETE /members retorna 204 sem body.
- finance/A6: record-sale.use-case.spec.ts (9 testes) e record-refund.use-case.spec.ts (10 testes).
- finance/A7: migration UNIQUE PARTIAL INDEX em payment_attempts (PENDING/PROCESSING por order_id); use case trata P2002 como PaymentAlreadyActiveError.
- orders/M9: REFUNDED adicionado ao union type OrderStatus.
- events/M2: update e updateConfiguration distinguem EventNotFoundError vs EventNotInDraftError vs EventVersionConflictError.
- events/M12: PublicationReadinessPolicy valida startsAt no passado (EVENT_STARTS_AT_IN_PAST), com guard para evento já encerrado.
- identity/M2: criação de emailVerificationToken feita atomicamente na mesma transação de registro.

**Sessão 8 — commits e3cdbc1, c085bd0, a041d95:**
- orders/M2: expireActiveReservations reescrito de O(R x (3+T)) queries para O(2) bulk SQL.
- events/A5: create-venue.use-case.spec.ts (9 testes) e list-organization-venues.use-case.spec.ts (5 testes).
- orders/M5: revogação de credenciais em cancelamento usa bulk UPDATE WHERE ticket_id = ANY(ids::uuid[]).
- orders/M6: outbox de cancelamento usa bulk INSERT via Prisma.join.
- inventory/M4: releaseHold — tentativa exata (AND reserved >= quantity) antes de fallback reset-to-0; log warn em underflow.
- tickets/M8: stale-while-revalidate reduzido de 30 para 5 segundos.
- identity/B2: algorithm: 'HS256' explícito no JwtModule.register.
- events/M9: hard limit take:200 em findByOrganization de venues.

Em andamento

Nenhuma tarefa em andamento — TASK-063 concluída.

Próxima fase

E2E manual em staging com auth real, load test, e configuração de cloud target para deployment.

**Sessão 9 — 2026-08-26:**
- marketplace/ConfirmationView.test.tsx: expectativa de texto sincronizada com componente (botão "Tentar novamente")
- backoffice/AttendanceDashboard.test.tsx: expectativa sincronizada com mensagem user-friendly
- payments/M1: `Number(item.quantity)` em process-payment-webhook — quantity string de $queryRaw corrigida
- payments/process-payment-webhook.use-case.spec.ts: novo teste cobre quantity como string
- prisma/schema.prisma: `@@index([accountId, occurredAt(sort: Desc)])` em LedgerEntry
- migration 20260826000040_add_ledger_entries_cursor_index: índice composto para cursor
- media/MediaUpload: métodos confirm(), markOrphaned(), isExpired() adicionados à entidade
- media/confirm-event-cover-upload: use case usa métodos da entidade (Rich Domain Model)
- notifications/outbox-notification.worker: SELECT FOR UPDATE SKIP LOCKED + processed_at atomicamente dentro da $transaction (BL2+A2)
- notifications/outbox-notification.worker.integration-spec: buyerEmail adicionado aos payloads + admin email corrigido
- platform-admin: 4 ports criados (IAdminUserRepository, IAdminOrganizationRepository, IAdminPayoutRepository, IAdminDashboardRepository)
- platform-admin: 4 adapters Prisma criados em infrastructure/repositories
- platform-admin: todos os 8 use cases migrados de PrismaService para ports (arquitetura hexagonal)
- platform-admin/M4: suspend-organization e suspend-user revogam sessões ativas dos membros imediatamente
- marketplace/AcceptTransferPage: captura e exibe newCredentialToken com botão copiar no estado SUCCESS
- tickets: PrismaTicketTransferRepository.spec.ts criado com 10 testes (cancel, find, acceptAtomically — incluindo paths de erro TransferAlreadyAcceptedError, TransferExpiredError, TicketAlreadyAdmittedError)
- 75 test suites (API) + 15 test suites (backoffice-web), 491 + 96 = 587 testes passando
- TASK-063 concluída: 0 ocorrências de devUserId/X-Dev-User-Id no backoffice, TypeScript limpo, 96/96 testes passando

**Sessão 10 — 2026-08-26:**
- TASK-064 concluída: auditoria arquitetural da API registrada; remediações futuras separadas por escopo.
- TASK-065 concluída: `PAYMENT_PROVIDER=fake` explícito, `FAKE_GATEWAY_SECRET` validado em produção e provider selecionado somente na infraestrutura.
- TASK-065: teste de wiring Nest cobre a resolução de `PAYMENT_GATEWAY_PORT` para `FakePaymentGateway`; rotas, DTOs, port, schema e migrations não foram alterados.

Pendências abertas (não bloqueantes para commit)
Ver relatórios individuais em .ai/reports/module-review-2026/ para lista completa por módulo.
Issues remanescentes após sessão 9:

- TASK-063: Autenticação real no backoffice — CONCLUÍDA (sessão 9)
- Orders/A3: total_amount = subtotal_amount — taxas nunca repassadas ao comprador (decisão de produto pendente)
- Tickets/A3: getAvailability vs tryReserve — duas fontes de verdade (decisão de design pendente)
- Tickets/A6 (parcial): prisma-ticket-credential, prisma-inventory, PrismaCheckInRepository ainda sem testes
- Tickets/M1: POST /public/transfers/:token/accept sem rate-limit
- Finance/M8: findOrCreateOrgAccount — padrão ON CONFLICT DO NOTHING + SELECT já é correto; falso positivo confirmado
- Notifications/A3: contrato de NotificationAlreadySentError (lançar vs retornar silenciosamente)
- Notifications/M3-M5: testes de adapters de email; campo html ausente no port
- Media/M2: maxBytes ignorado na URL pré-assinada — limitação documentada (validação é post-upload)
- Media/B1: MAX_UPLOAD_SIZE_BYTES não configurável via env — pendente de escopo
- Events/M9: paginação por cursor em venues (mitigado com take:200, solução definitiva pendente)

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
TASK-061 — Backup, Disaster Recovery & Operational Runbooks. (CONCLUÍDA)
TASK-062 — Release Readiness & E2E Certification. (CONCLUÍDA)
TASK-063 — Backoffice Auth Integration. (CONCLUÍDA)
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
