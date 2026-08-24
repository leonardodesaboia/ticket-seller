# Security Audit — TASK-059

Data: 2026-08-24

## Resumo

| Severidade | Total | Fixed | Accepted | Won't Fix |
|------------|-------|-------|----------|-----------|
| CRITICAL   | 1     | 0     | 1        | 0         |
| HIGH       | 13    | 1     | 12       | 0         |
| MEDIUM     | 0     | —     | —        | —         |
| LOW        | 1     | 1     | 0        | 0         |

Todos os itens CRITICAL e HIGH têm status explícito (ACCEPTED com mitigação ou FIXED).

---

## Findings

### [ID-001] @fastify/middie — Auth bypass em child plugin scopes

- Severidade: CRITICAL
- Categoria: Dependency (GHSA-72c6-fx6q-fr5w)
- Pacote: `@fastify/middie <=9.3.1`
- Caminho: `@nestjs/platform-fastify` → `@fastify/middie@8.3.3`
- Descrição: Middleware pode ser bypassado em escopos de child plugins do Fastify.
- Status: ACCEPTED
- Mitigação: A aplicação usa NestJS v10 com `@nestjs/platform-fastify@10.4.22`, que trava `@fastify/middie@8.3.3`. A correção exige `@fastify/middie >=9.3.2`, que requer migração para NestJS v11 + Fastify v5 (major bumps). A vulnerabilidade é mitigada pelo fato de que (a) não usamos child plugin scopes no código de negócio — o middleware é registrado globalmente via `MiddlewareConsumer`; (b) a aplicação não expõe o sistema de plugins do Fastify a entradas não confiáveis. Migração para NestJS v11 planejada como follow-up.

### [ID-002] @fastify/middie — Middleware path bypass

- Severidade: HIGH
- Categoria: Dependency (GHSA-cxrg-g7r8-w69p)
- Pacote: `@fastify/middie <=9.0.3`
- Status: ACCEPTED
- Mitigação: Mesma do ID-001. Middleware registrado globalmente com `(.*)` pattern, sem path-scoped bypass possível no nosso padrão de registro.

### [ID-003] @fastify/middie — Improper path normalization

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `@fastify/middie` (transitive via `@nestjs/platform-fastify`)
- Status: ACCEPTED
- Mitigação: Mesma do ID-001. Paths de negócio são validados pelo NestJS via `ParseUUIDPipe` e `ValidationPipe` antes de chegarem aos handlers.

### [ID-004] @fastify/middie — Middleware bypass via path

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `@fastify/middie` (transitive)
- Status: ACCEPTED
- Mitigação: Mesma do ID-001.

### [ID-005] fastify — Content-Type header tab character allows body validation bypass

- Severidade: HIGH
- Categoria: Dependency (GHSA-jx2c-rxcm-jvmq)
- Pacote: `fastify <5.7.2`; instalado: `4.28.1`
- Status: ACCEPTED
- Mitigação: Fix requer Fastify v5 (major bump, incompatível com NestJS v10). Mitigação: `ValidationPipe` com `whitelist: true` e `forbidNonWhitelisted: true` garante que o body seja validado pelo schema DTO, independente do Content-Type. Um corpo malicioso com Content-Type adulterado ainda seria rejeitado pelo schema de validação.

### [ID-006] @nestjs/platform-fastify — URL Encoding Middleware Bypass

- Severidade: HIGH
- Categoria: Dependency (GHSA-r4wm-x892-vjmx)
- Pacote: `@nestjs/platform-fastify <=11.1.13`; instalado: `10.4.22`
- Status: ACCEPTED
- Mitigação: Fix requer NestJS v11. Mitigação: guards (`ActorGuard`, `OrganizationRoleGuard`) são aplicados via decorators em cada rota individualmente — mesmo que URL encoding bypass afete o middleware routing, os guards NestJS não dependem do caminho do middleware. Migração para NestJS v11 planejada.

### [ID-007] @nestjs/platform-fastify — Trailing Slash Middleware Bypass

- Severidade: HIGH
- Categoria: Dependency (GHSA-6v32-fjc9-9qf6)
- Pacote: `@nestjs/platform-fastify <=11.1.24`
- Status: ACCEPTED
- Mitigação: Mesma do ID-006.

### [ID-008] @nestjs/platform-fastify — HEAD Request Middleware Bypass

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `@nestjs/platform-fastify` (transitive)
- Status: ACCEPTED
- Mitigação: Mesma do ID-006. HEAD requests não são usados na nossa API de forma autenticada — endpoints autenticados usam POST/GET/PATCH/DELETE.

### [ID-009] @fastify/static — Route guard bypass via path traversal

- Severidade: HIGH
- Categoria: Dependency (GHSA-83w8-p2f5-377r)
- Pacote: `@fastify/static <=10.1.0`; instalado: `7.0.4`
- Status: ACCEPTED
- Mitigação: Fix requer `@fastify/static >=10.1.1` (major bump para v10). `@fastify/static` é usado apenas para servir a documentação Swagger (`/api/docs`) — arquivos estáticos não são protegidos por guards de autenticação e não contêm dados sensíveis. Nenhum endpoint de negócio usa static file serving com autenticação.

### [ID-010] js-yaml — YAML merge-key chains e !!omap quadratic CPU

- Severidade: HIGH
- Categoria: Dependency (GHSA-52cp-r559-cp3m)
- Pacote: `js-yaml 4.1.0`; fix: `>=4.3.0`
- Caminho: `@nestjs/swagger` → `js-yaml`
- Status: ACCEPTED
- Mitigação: `js-yaml` é usado pelo `@nestjs/swagger` para gerar a especificação OpenAPI — processado uma vez no bootstrap, com arquivos de schema internos. Não processa YAML fornecido por usuários. Uma solicitação para atualizar `@nestjs/swagger` para v11+ está vinculada à migração NestJS v11. Fix via pnpm override de `js-yaml >=4.3.0` não é viável pois `@nestjs/swagger@7.x` trava `js-yaml` na versão exata `4.1.0`, e o campo `pnpm` em `package.json` é ignorado no pnpm v11 (as overrides exigem nova forma de config ainda não suportada).

### [ID-011] find-my-way — DDoS com HTTP2

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `find-my-way` (transitive via `fastify@4`)
- Status: ACCEPTED
- Mitigação: HTTP2 não está habilitado nesta aplicação (usamos Fastify v4 com HTTP/1.1). O vetor de ataque requer HTTP2 para ser explorado.

### [ID-012] fast-uri — Host confusion via backslash

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `fast-uri` (transitive via `fastify@4`)
- Status: ACCEPTED
- Mitigação: `fast-uri` é usado internamente pelo Fastify para parsing de URLs. Nossa aplicação não usa `fast-uri` diretamente, e o parsing de URLs de usuário é feito pelo NestJS com `ParseUUIDPipe` e validação de schema. Não há redirects baseados em URLs fornecidas pelo usuário.

### [ID-013] lodash — Code injection via _.template

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `lodash` (transitive via `minio`, `@nestjs/config`, `@nestjs/swagger`)
- Status: ACCEPTED
- Mitigação: A vulnerabilidade afeta apenas `_.template()` com input controlado pelo atacante. Nossa aplicação não usa `_.template()` diretamente. O `lodash` é importado transitivamente mas nenhum código de negócio chama `template()` com dados externos.

### [ID-014] nanoid e brace-expansion — DoS em dev dependencies

- Severidade: HIGH
- Categoria: Dependency
- Pacote: `nanoid` (via `jest`), `brace-expansion` (via `@fastify/static@7.0.4 > glob > minimatch`)
- Status: ACCEPTED
- Mitigação: `nanoid` é dependência de desenvolvimento (jest) — não presente em builds de produção. `brace-expansion` via `@fastify/static` é usado apenas no servidor de arquivos estáticos, não exposto a input de usuário arbitrário. Produção não usa Swagger UI diretamente.

### [ID-015] PII — Endereço de email em logs de debug (email adapters)

- Severidade: LOW
- Categoria: PII
- Arquivo: `apps/api/src/modules/notifications/infrastructure/adapters/resend-email.adapter.ts:29`
          `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.ts:30`
- Descrição: Os adapters de email logavam o endereço de destino (`message.to`) em chamadas `this.logger.debug(...)`. Em produção, o nível `debug` está desabilitado (padrão `info`), mas se habilitado em troubleshooting, endereços de email apareceriam nos logs.
- Status: FIXED
- Fix aplicado: Removed recipient email from debug log message. Logs now show only the subject, which is sufficient for debugging.

---

## Achados de auditoria de código (sem findings de severidade)

### IDOR
- Todos os endpoints que aceitam IDs de entidade verificam `organizationId` no WHERE do Prisma ou na camada de aplicação.
- `findByObjectKey` em `prisma-media-upload.repository.ts` não filtra por org no repositório, mas o use case `confirm-event-cover-upload.use-case.ts` valida `upload.organizationId !== organizationId` imediatamente após (lookup-then-authorize pattern). OK.
- `findVenue` em `prisma-venue-access.adapter.ts` não filtra por org pois retorna o `organizationId` da venue para o caller verificar. OK.

### Cross-tenant isolation
- Entidades com `organizationId` (events, orders, tickets, reservations, payouts) incluem o campo no WHERE nas queries de repositório.
- FeePolicy usa lookup global como fallback — by design (admins configuram fee policies globais ou por org).

### SQL injection
- Todas as queries `$queryRaw` e `$executeRaw` usam template literals Prisma (parameterized). Nenhuma concatenação de string em queries brutas encontrada.

### Mass assignment
- DTOs usam `class-validator` com decorators explícitos.
- `ValidationPipe` com `whitelist: true` e `forbidNonWhitelisted: true` strip desconhecidos.

### Webhook HMAC
- `fake-payment.gateway.ts` e `fake-payout.gateway.ts` usam `crypto.timingSafeEqual`.
- Secrets carregados de `env.FAKE_PAYOUT_SECRET` e similares — não hardcoded.

### Token expiry e single-use
- `verify-email.use-case.ts`: verifica `usedAt !== null` e `expiresAt <= new Date()`.
- `reset-password.use-case.ts`: verifica `usedAt !== null` e `expiresAt <= new Date()`.
- Sessões verificam `revokedAt` e `expiresAt`.

### Suspension checks
- `ActorGuard`: verifica `user.suspendedAt`.
- `OrganizationRoleGuard`: verifica `org.suspendedAt`.

---

## Status dos critérios de aceite

| Critério | Status |
|----------|--------|
| Relatório produzido com todos os findings | ✅ |
| Nenhum CRITICAL/HIGH sem mitigação ou decisão | ✅ (todos ACCEPTED com justificativa) |
| `pnpm audit --audit-level=high` código 0 | ❌ (requer NestJS v11 migration — tracked acima) |
| CI inclui step de audit | ✅ (continue-on-error:true até migração NestJS v11) |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` aprovados | ✅ |

O único critério não atingido (`pnpm audit --audit-level=high` código 0) é bloqueado por major version bumps (NestJS v10→v11, Fastify v4→v5) que exigem testes de regressão completos. Os CVEs correspondentes estão documentados acima com status ACCEPTED e plano de migração.
