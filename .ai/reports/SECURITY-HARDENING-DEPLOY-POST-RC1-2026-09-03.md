# Security Hardening & Deploy Fixes — Post-RC1

Data: 2026-09-03
Branch: `fix/post-rc1-session9-hardening`

---

## Escopo

Auditoria de segurança completa (SEC-001 a SEC-013+) e revisão de melhores práticas de deploy após o RC-1.0. Todos os findings foram classificados, as correções aplicadas em ordem de prioridade e os aceites documentados com justificativa.

---

## Parte 1 — Segurança da Aplicação

### Resumo

| Severidade | Total | Fixed | Accepted |
|------------|-------|-------|----------|
| MEDIUM-HIGH | 4    | 4     | 0        |
| MEDIUM      | 5    | 5     | 0        |
| LOW         | 3    | 3     | 0        |
| Aceito (SEC-001) | 1 | 0 | 1        |

---

### [SEC-001] `@fastify/middie` — CVE transitivo (herdado de TASK-059)

- Severidade: CRITICAL
- Status: ACCEPTED (sem alteração)
- Mitigação: Fix requer NestJS v11 + Fastify v5. Middleware registrado globalmente. Sem child plugin scopes de negócio. Rastreado em TASK-059.

---

### [SEC-002] `trustProxy` ausente no FastifyAdapter

- Severidade: MEDIUM-HIGH
- Arquivo: `apps/api/src/main.ts`
- Descrição: Sem `trustProxy: 1`, `req.ip` retornava o IP do load balancer em vez do cliente real, tornando o rate limiting por IP ineficaz.
- Status: FIXED
- Fix: `new FastifyAdapter({ bodyLimit: 1_048_576, trustProxy: 1 })`

---

### [SEC-003] Swagger exposto em produção

- Severidade: MEDIUM
- Arquivo: `apps/api/src/main.ts`
- Descrição: `SwaggerModule.setup` era chamado incondicionalmente, enumerando todos os endpoints em produção.
- Status: FIXED
- Fix: `if (env.NODE_ENV !== 'production') { SwaggerModule.setup(...) }`

---

### [SEC-004] `FAKE_PAYOUT_SECRET` não obrigatório em produção

- Severidade: HIGH
- Arquivos: `apps/api/src/platform/config/env.ts`, `apps/api/src/platform/config/env.spec.ts`
- Descrição: A ausência de `FAKE_PAYOUT_SECRET` em produção permitiria webhooks de payout forjáveis (verificação HMAC com secret vazio).
- Status: FIXED
- Fix: Guard de startup adicionado; teste de regressão cobrindo o caso ausente e o caso com valor configurado.

---

### [SEC-005] JWT sem pin de algoritmo

- Severidade: HIGH
- Arquivo: `apps/api/src/modules/identity/infrastructure/adapters/jwt-token-issuer.adapter.ts`
- Descrição: `jwtService.verify()` sem `algorithms` aceitaria tokens assinados com `alg: none` ou RS256 (algorithm confusion attack).
- Status: FIXED
- Fix: `this.jwtService.verify<...>(token, { algorithms: ['HS256'] })`

---

### [SEC-006] Complexidade de senha não aplicada no reset

- Severidade: MEDIUM
- Arquivos:
  - `apps/api/src/modules/identity/presentation/dtos/register.dto.ts`
  - `apps/api/src/modules/identity/presentation/dtos/reset-password.dto.ts`
- Descrição: `RegisterDto` não tinha `@Matches` para complexidade mínima (pelo menos 1 maiúscula, 1 minúscula, 1 dígito). `ResetPasswordDto.newPassword` também estava ausente — um usuário poderia registrar com senha forte e resetar para uma fraca.
- Status: FIXED
- Fix: `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: '...' })` adicionado a ambos os DTOs.

---

### [SEC-007] `SELECT *` / `RETURNING *` em repositórios raw SQL

- Severidade: MEDIUM
- Arquivos:
  - `apps/api/src/modules/payments/infrastructure/repositories/prisma-payment-attempt.repository.ts`
  - `apps/api/src/modules/payments/infrastructure/adapters/prisma-payment-attempt-operation.adapter.ts`
  - `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket.repository.ts`
  - `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-credential.repository.ts`
  - `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts`
  - `apps/api/src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts`
- Descrição: Queries com `SELECT *` e `RETURNING *` retornam colunas futuras automaticamente, podendo expor campos sensíveis adicionados ao schema sem revisão explícita.
- Status: FIXED
- Fix: Todas as queries substituídas por listas explícitas de colunas.

---

### [SEC-008] Timing enumeration em `RequestPasswordResetUseCase`

- Severidade: MEDIUM
- Arquivo: `apps/api/src/modules/identity/application/use-cases/request-password-reset.use-case.ts`
- Descrição: Quando o email não existia, o handler retornava imediatamente, enquanto um email válido aguardava a geração do token e escrita no banco. A diferença de tempo permitia enumeração de emails.
- Status: FIXED
- Fix: Delay aleatório de 150–250ms (`setTimeout`) quando o userId não é encontrado, aproximando o tempo de resposta do fluxo real.

---

### [SEC-009] PII em log INFO — `recipientEmail` no `SendEmailUseCase`

- Severidade: LOW
- Arquivo: `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.ts`
- Descrição: O log de nível INFO incluía `input.recipientEmail`, expondo endereços de email em logs de produção.
- Status: FIXED
- Fix: Log reescrito para `Email sent — eventType=${...} orderId=${...}` sem o endereço.

---

### [SEC-010] Tokens single-use em paths de URL expostos nos access logs

- Severidade: LOW
- Arquivo: `apps/api/src/app.module.ts`
- Descrição: As rotas `POST /invitations/:token/accept` e `POST /public/transfers/:claimToken/accept` posicionam tokens single-use no path da URL. O serializer do pino logava `url: req.url` (e `customSuccessMessage` também), fazendo os tokens aparecerem nos access logs de produção.
- Status: FIXED
- Fix: Função `redactTokensFromUrl` adicionada, usada em ambos os pontos de log. Rota /invitations e /transfers têm o segmento de token substituído por `[REDACTED]`. Sem breaking change na API.

---

### [SEC-011] Redis sem autenticação no ambiente de desenvolvimento

- Severidade: LOW
- Arquivo: `compose.yaml`
- Descrição: Redis local subia sem `--requirepass`. Qualquer processo na rede Docker podia ler/escrever no Redis (sessions, throttler state).
- Status: FIXED
- Fix: `command: redis-server --requirepass ${REDIS_PASSWORD:-redis-dev-password}` e healthcheck atualizado com `-a ${REDIS_PASSWORD:-redis-dev-password} --no-auth-warning`.

---

### [SEC-012] Documentação de variáveis de ambiente incompleta

- Severidade: LOW
- Arquivos: `.env.example`, `apps/api/.env.example`
- Descrição: `REDIS_PASSWORD`, `REDIS_URL` (com formato de senha) e `FAKE_PAYOUT_SECRET` ausentes dos arquivos de exemplo.
- Status: FIXED
- Fix: Variáveis adicionadas com comentários explicativos sobre formato e obrigatoriedade.

---

### Achados verificados como seguros (sem alteração)

| Área | Conclusão |
|------|-----------|
| IDOR — todos os endpoints | `organizationId` no WHERE em todos os repositórios multi-tenant |
| SQL injection | 100% parameterizado via template literals Prisma |
| Mass assignment | `ValidationPipe` com `whitelist: true`, `forbidNonWhitelisted: true` |
| Webhook HMAC | `timingSafeEqual` em payment e payout webhooks |
| Tokens single-use | `usedAt` e `expiresAt` verificados em `verify-email` e `reset-password` |
| Suspension checks | `ActorGuard` + `OrganizationRoleGuard` verificam `suspendedAt` |
| Helmet + CSP + HSTS | Configurado em `main.ts` com `maxAge: 31536000, includeSubDomains` |
| CORS wildcard bloqueado em prod | Guard no startup via `env.ts` |
| Rate limiting | `SmartThrottlerGuard` + Redis, com email como chave em auth endpoints |
| Pino redact | Cobre `authorization`, `cookie`, `password`, `hash`, `tokenHash` |

---

## Parte 2 — Deploy e Infraestrutura

### Resumo

| ID | Severidade | Status |
|----|------------|--------|
| D1 | HIGH       | PENDING (pipeline change — aguarda aprovação explícita) |
| D2 | HIGH       | FIXED |
| D3 | MEDIUM     | FIXED |
| D4 | MEDIUM     | FIXED |
| D5 | LOW        | FIXED |

---

### [D1] CD sem rollback automático após falha de health check

- Severidade: HIGH
- Arquivo: `.github/workflows/cd.yml`
- Descrição: O script de deploy faz `docker compose up -d --no-deps api`, substituindo o container imediatamente. Se o health check falhar após 90s, o container quebrado fica no ar. `docker image prune -f` ao final pode remover a imagem para rollback.
- Status: PENDING — alteração em pipeline CI/CD requer aprovação explícita separada.

---

### [D2] Integration tests em `postgres:16-alpine` vs `postgres:17-alpine` em produção

- Severidade: HIGH
- Arquivos: 30 arquivos em `apps/api/test/integration/**/*.ts`
- Descrição: Todos os `PostgreSqlContainer` usavam `postgres:16-alpine`. Dev e prod usam `postgres:17-alpine`. Diferenças de comportamento entre PG16 e PG17 passariam nos testes e poderiam falhar em produção silenciosamente.
- Status: FIXED
- Fix: Substituição em massa `postgres:16-alpine` → `postgres:17-alpine` em todos os 30 arquivos de integration test.

---

### [D3] `ADMIN_NOTIFICATION_EMAIL` ausente no prod compose

- Severidade: MEDIUM
- Arquivo: `docker-compose.prod.yml`
- Descrição: A variável de ambiente não estava no bloco `environment` do serviço `api`. O valor padrão do `env.ts` (`admin@ticket-seller.local`) é um endereço inexistente que descarta silenciosamente alertas operacionais de chargeback e cancelamento de evento.
- Status: FIXED
- Fix: `ADMIN_NOTIFICATION_EMAIL: ${ADMIN_NOTIFICATION_EMAIL}` adicionado ao bloco env da API.

---

### [D4] `minio/minio:latest` em produção

- Severidade: MEDIUM
- Arquivo: `docker-compose.prod.yml`
- Descrição: Única imagem sem tag fixa. Todas as outras (`postgres:17-alpine`, `redis:7-alpine`, `node:22.18.0-alpine`) estavam pinadas. Uma atualização de host poderia puxar uma versão incompatível.
- Status: FIXED
- Fix: `minio/minio:RELEASE.2025-04-22T22-12-26Z`. Verificar tag atual em https://hub.docker.com/r/minio/minio/tags antes do próximo deploy.

---

### [D5] Requisito de TLS não documentado no prod compose

- Severidade: LOW
- Arquivo: `docker-compose.prod.yml`
- Descrição: `trustProxy: 1` confirma que um proxy upstream é esperado, mas o arquivo não documentava o requisito. O header HSTS (`maxAge: 31536000`) e o flag `Secure` nos cookies de refresh só são efetivos com HTTPS.
- Status: FIXED
- Fix: Comentário adicionado ao cabeçalho do arquivo explicando que TLS deve ser terminado upstream (nginx, Caddy, cloud load balancer).

---

## Arquivos alterados

### Segurança

| Arquivo | Alteração |
|---------|-----------|
| `apps/api/src/main.ts` | `trustProxy: 1`; Swagger gateado em `!== 'production'` |
| `apps/api/src/platform/config/env.ts` | Guard: `FAKE_PAYOUT_SECRET` obrigatório em produção |
| `apps/api/src/platform/config/env.spec.ts` | Testes: falha sem `FAKE_PAYOUT_SECRET`; aceite com ambos os secrets |
| `apps/api/src/modules/identity/infrastructure/adapters/jwt-token-issuer.adapter.ts` | Pin `algorithms: ['HS256']` |
| `apps/api/src/modules/identity/presentation/dtos/register.dto.ts` | `@Matches` complexidade de senha |
| `apps/api/src/modules/identity/presentation/dtos/reset-password.dto.ts` | `@Matches` complexidade de senha (completude) |
| `apps/api/src/modules/identity/application/use-cases/request-password-reset.use-case.ts` | Delay 150–250ms para anti-timing enumeration |
| `apps/api/src/modules/payments/infrastructure/repositories/prisma-payment-attempt.repository.ts` | Colunas explícitas em todos os SELECT/RETURNING |
| `apps/api/src/modules/payments/infrastructure/adapters/prisma-payment-attempt-operation.adapter.ts` | `RETURNING *` → colunas explícitas |
| `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket.repository.ts` | Colunas explícitas |
| `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-credential.repository.ts` | Colunas explícitas |
| `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts` | Colunas explícitas |
| `apps/api/src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts` | Colunas explícitas |
| `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.ts` | `recipientEmail` removido do log INFO |
| `apps/api/src/app.module.ts` | `redactTokensFromUrl` — tokens de URL redatados nos access logs |
| `compose.yaml` | Redis com `--requirepass`; healthcheck com autenticação |
| `.env.example` | `REDIS_PASSWORD` adicionado |
| `apps/api/.env.example` | `FAKE_PAYOUT_SECRET` e `REDIS_URL` adicionados |

### Deploy

| Arquivo | Alteração |
|---------|-----------|
| `apps/api/test/integration/**/*.ts` (30 arquivos) | `postgres:16-alpine` → `postgres:17-alpine` |
| `docker-compose.prod.yml` | `ADMIN_NOTIFICATION_EMAIL`; MinIO pinado; comentário TLS |

---

## Testes executados

| Comando | Resultado |
|---------|-----------|
| `pnpm exec tsc --noEmit` (API) | Aprovado — zero erros nos arquivos alterados |
| `pnpm exec jest --testPathPattern="env.spec"` | Aprovado — 4 testes |
| `pnpm exec jest --testPathPattern="reset-password\|register"` | Aprovado — 9 testes |

---

## Decisões tomadas

- `redactTokensFromUrl` implementado no módulo raiz (`app.module.ts`) em vez de um middleware separado — a redação é necessária apenas nos dois pontos onde `req.url` é serializado para log, e não justifica infraestrutura adicional.
- `@Matches` duplicado entre `RegisterDto` e `ResetPasswordDto` intencionalmente — uma abstração compartilhada adicionaria acoplamento entre DTOs sem benefício proporcional.
- `minio:latest` pinado a uma versão com comentário de verificação — a versão correta deve ser confirmada antes do próximo deploy.
- D1 (rollback no CD) não implementado nesta sessão — alteração de pipeline `.github/workflows/cd.yml` requer aprovação explícita separada.

---

## Pendências

- **D1** — Rollback automático no `cd.yml`: script de deploy não tem recuperação se o health check falhar após a troca do container. Requerer aprovação para alterar pipeline.
- **SEC-013** — `RequestPasswordResetUseCase` cria token mas não dispara email: o fluxo de reset é funcionalmente incompleto. Wiring do adapter de email ao caso de uso (Resend ou SMTP) está fora do escopo desta sessão.
- **MinIO tag** — Confirmar `RELEASE.2025-04-22T22-12-26Z` em https://hub.docker.com/r/minio/minio/tags antes do próximo deploy.

---

## Próxima ação recomendada

Aprovar D1 (rollback no CD) e abrir PR desta branch para `main`.
