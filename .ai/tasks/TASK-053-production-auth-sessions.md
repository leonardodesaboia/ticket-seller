TASK-053 — Production Authentication & Sessions

Status: CONCLUÍDA

Objetivo

Substituir o DevelopmentActorAdapter por autenticação real baseada em email + senha com argon2id, JWT (access token 15min + refresh token 30 dias em HttpOnly cookie) e um `JwtActorAdapter` que implementa a mesma interface `IActorAdapter` já existente. O DevelopmentActorAdapter é mantido para development; em produção o HttpModule usa o JwtActorAdapter via factory.

Resultado observável

- `POST /auth/register` cria usuário + identity + password_credential e envia email de verificação.
- `POST /auth/login` autentica, cria session, retorna access token (Bearer) + refresh token (cookie).
- `POST /auth/refresh` emite novo access token, rotaciona refresh token.
- `POST /auth/logout` revoga session corrente.
- `POST /auth/forgot-password` cria token de reset e envia email.
- `POST /auth/reset-password` aplica novo hash, invalida token, revoga todas as sessions.
- `POST /auth/verify-email` marca Identity.emailVerified = true.
- `GET /auth/me` retorna dados do usuário autenticado.
- Todos os endpoints existentes protegidos por `ActorGuard` funcionam com o JWT real em production.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-053-production-auth-sessions.md
- docs/modules/identity.md
- docs/modules/users.md
- apps/api/src/platform/http/ (actor-adapter.port.ts, actor.guard.ts, http.module.ts, adapters/development-actor.adapter.ts)
- apps/api/src/shared/kernel/actor.types.ts
- apps/api/prisma/schema.prisma
- apps/api/package.json
- docs/decisions/ADR-007-auth-propria-jwt-refresh-rotation.md

Migrations (base: 20260818000029)

```
20260818000030_password_credentials
  - id UUID PK
  - user_id UUID FK users.id UNIQUE (um por usuário)
  - hash TEXT NOT NULL
  - algorithm VARCHAR(32) NOT NULL DEFAULT 'argon2id'
  - force_reset BOOLEAN NOT NULL DEFAULT false
  - last_changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  - created_at TIMESTAMPTZ NOT NULL DEFAULT now()

20260818000031_sessions
  - id UUID PK
  - user_id UUID FK users.id NOT NULL
  - token_hash TEXT NOT NULL UNIQUE
  - ip INET
  - user_agent TEXT
  - expires_at TIMESTAMPTZ NOT NULL
  - revoked_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  - INDEX (user_id, revoked_at, expires_at) para busca ativa

20260818000032_email_verification_tokens
  - id UUID PK
  - user_id UUID FK users.id NOT NULL
  - token_hash TEXT NOT NULL UNIQUE
  - expires_at TIMESTAMPTZ NOT NULL (24h)
  - used_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ NOT NULL DEFAULT now()

20260818000033_password_reset_tokens
  - id UUID PK
  - user_id UUID FK users.id NOT NULL
  - token_hash TEXT NOT NULL UNIQUE
  - expires_at TIMESTAMPTZ NOT NULL (1h)
  - used_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ NOT NULL DEFAULT now()

20260818000034_authentication_attempts
  - id UUID PK
  - email VARCHAR(320) NOT NULL
  - ip INET NOT NULL
  - outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('SUCCESS','FAILURE','LOCKED'))
  - attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  - INDEX (email, ip, attempted_at) para rate limit query
```

Arquivos permitidos

Backend:
- apps/api/src/modules/identity/ (NOVO módulo completo)
  - domain/entities/session.entity.ts
  - domain/entities/password-credential.entity.ts
  - domain/entities/auth-attempt.entity.ts
  - domain/ports/password-hasher.port.ts
  - domain/ports/session.repository.port.ts
  - domain/ports/token-issuer.port.ts
  - domain/ports/email-verification.repository.port.ts
  - domain/ports/password-reset.repository.port.ts
  - domain/ports/auth-attempt.repository.port.ts
  - application/use-cases/register-with-password.use-case.ts + .spec.ts
  - application/use-cases/authenticate-with-password.use-case.ts + .spec.ts
  - application/use-cases/refresh-session.use-case.ts + .spec.ts
  - application/use-cases/revoke-session.use-case.ts + .spec.ts
  - application/use-cases/request-email-verification.use-case.ts
  - application/use-cases/verify-email.use-case.ts + .spec.ts
  - application/use-cases/request-password-reset.use-case.ts + .spec.ts
  - application/use-cases/reset-password.use-case.ts + .spec.ts
  - application/use-cases/get-current-identity.use-case.ts
  - infrastructure/adapters/argon-password-hasher.adapter.ts
  - infrastructure/adapters/jwt-token-issuer.adapter.ts
  - infrastructure/adapters/jwt-actor.adapter.ts
  - infrastructure/repositories/prisma-session.repository.ts
  - infrastructure/repositories/prisma-email-verification.repository.ts
  - infrastructure/repositories/prisma-password-reset.repository.ts
  - infrastructure/repositories/prisma-auth-attempt.repository.ts
  - presentation/controllers/auth.controller.ts
  - presentation/dtos/register.dto.ts
  - presentation/dtos/login.dto.ts
  - presentation/dtos/refresh.dto.ts
  - presentation/dtos/forgot-password.dto.ts
  - presentation/dtos/reset-password.dto.ts
  - presentation/dtos/verify-email.dto.ts
  - identity.module.ts
- apps/api/src/platform/http/http.module.ts (EXPANDIR — factory para JwtActorAdapter em production)
- apps/api/src/platform/config/env.ts (EXPANDIR — JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, RESEND_API_KEY)
- apps/api/prisma/schema.prisma (EXPANDIR — novos models)
- apps/api/prisma/migrations/ (5 novas migrations)
- apps/api/src/app.module.ts (EXPANDIR — importar IdentityModule)
- apps/api/test/integration/identity/ (testes de integração)

Arquivos proibidos

- apps/api/src/platform/http/adapters/development-actor.adapter.ts (sem alterar — apenas manter)
- apps/api/src/modules/finance/ (sem alterações)
- apps/api/src/modules/payments/ (sem alterações)
- apps/api/src/modules/orders/ (sem alterações)
- pnpm-lock.yaml (pnpm install gerencia automaticamente)

Packages novos

```
argon2 (hashing)
@nestjs/jwt (JWT issuer)
jsonwebtoken (tipos)
```

Variáveis de ambiente novas

```
JWT_SECRET          string, obrigatório em production
JWT_ACCESS_EXPIRY   string, default '15m'
JWT_REFRESH_EXPIRY  string, default '30d'
RESEND_API_KEY      string, opcional (sem envio de email em dev se ausente)
```

Requisitos funcionais

1. Registro (`POST /auth/register`):
   - Valida email único e formato.
   - Cria User + Identity(provider=local) + PasswordCredential.
   - Envia email de verificação se RESEND_API_KEY presente.
   - Responde 201 sem expor hash.

2. Login (`POST /auth/login`):
   - Verifica tentativas recentes: 5 falhas em 15min → 429.
   - Busca Identity por email, carrega PasswordCredential.
   - argon2.verify(hash, senha). Falha → registra AuthAttempt(FAILURE), responde 401 genérico.
   - Sucesso → cria Session (expires_at = now + 30d), emite access token JWT (15min) + refresh token opaco (SHA-256 do UUID), cookie HttpOnly Secure SameSite=Strict.
   - Registra AuthAttempt(SUCCESS).
   - Responde: `{ accessToken, user: { id, email, displayName } }`.

3. Refresh (`POST /auth/refresh`):
   - Lê refresh token do cookie.
   - Busca Session por token_hash. Valida: não revogada, não expirada.
   - Revoga session atual, cria nova session (rotation).
   - Emite novo access token + novo refresh token cookie.

4. Logout (`POST /auth/logout`):
   - Requer ActorGuard (access token válido).
   - Revoga session (sets revoked_at = now).
   - Limpa cookie.

5. Reset de senha:
   - `POST /auth/forgot-password`: cria PasswordResetToken (1h), envia email. Responde 200 sempre (anti-enumeração).
   - `POST /auth/reset-password`: verifica token, aplica novo hash, marca token used_at, revoga todas as sessions do usuário.

6. Verificação de email:
   - `POST /auth/verify-email`: verifica token, marca Identity.emailVerified = true (adicionar campo ao schema), marca token used_at.

7. `GET /auth/me`:
   - Requer ActorGuard.
   - Retorna: `{ id, email, displayName, emailVerified, locale, timezone }`.

8. JwtActorAdapter:
   - Implementa IActorAdapter.
   - Lê Bearer token do header Authorization.
   - Verifica assinatura JWT com JWT_SECRET.
   - Valida exp, iat.
   - Busca Session ativa por jti (session id no payload).
   - Retorna `{ userId: payload.sub }` ou null.
   - Em production: DevelopmentActorAdapter não é registrado; JwtActorAdapter é injetado via factory.
   - Em development: mantém DevelopmentActorAdapter como default (sem JWT_SECRET obrigatório).

Requisitos técnicos

- argon2id: `{ memoryCost: 65536, timeCost: 3, parallelism: 4 }`.
- Access token payload: `{ sub: userId, jti: sessionId, iat, exp }`.
- Refresh token: UUID v4 → SHA-256 hex → armazenado em `sessions.token_hash`. Token bruto retornado ao cliente no cookie.
- Cookie do refresh token: `HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000`.
- Todas as respostas de erro de auth retornam a mesma mensagem genérica: `"Invalid credentials"`.
- PasswordResetToken e EmailVerificationToken: UUID v4 → SHA-256 hex para armazenamento; token bruto no email.
- tokens single-use: `used_at IS NULL` verificado antes de aplicar.

Invariantes

- Nunca expor hash de senha em logs ou respostas.
- Nunca expor session token_hash em logs ou respostas.
- Account enumeration: registro, login, reset-password retornam mensagens indistinguíveis para email não encontrado.
- Rotation de refresh token: session anterior sempre revogada antes de criar nova.
- PasswordResetToken single-use e com expiração de 1h.
- EmailVerificationToken single-use e com expiração de 24h.

Segurança

- `AuthAttempt` registra tentativas para rate limiting contextual.
- DevelopmentActorAdapter nunca ativo em `NODE_ENV=production` (invariante já existente).
- JWT_SECRET mínimo 256 bits (validado no env schema: `z.string().min(32)`).
- Cookie Secure: ativo quando `NODE_ENV=production` (via env check no controller).

Fora do escopo

- MFA / TOTP (pós-MVP — ADR-007).
- OAuth / OIDC providers (pós-MVP — IActorAdapter adicional).
- Sessões de dispositivo (listagem de devices ativos).
- Rate limiting por IP implementado por infraestrutura — throttler é da TASK-057; TASK-053 registra apenas AuthAttempts para a lógica de lock por email+ip.

Critérios de aceite

- Registro, login, refresh, logout, reset-senha, verificação-email funcionam end-to-end.
- Endpoint protegido por ActorGuard retorna 401 sem token válido.
- Com JWT válido e session ativa, ActorGuard resolve actor corretamente.
- Token revogado não autentica (JwtActorAdapter consulta session no DB).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api add argon2 @nestjs/jwt jsonwebtoken
pnpm --filter @ticket-seller/api add -D @types/jsonwebtoken
pnpm --filter @ticket-seller/api prisma migrate dev --name password_credentials
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration --testPathPattern=identity
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-054 — Organization Members, Roles & Permissions.
