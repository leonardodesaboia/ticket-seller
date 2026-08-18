Relatório da TASK-053 — Production Authentication & Sessions
Status

COMPLETED

Arquivos alterados
Backend (apps/api/):
apps/api/prisma/migrations/20260818000030_password_credentials/migration.sql: NOVO — tabela password_credentials + emailVerified em identities
apps/api/prisma/migrations/20260818000031_sessions/migration.sql: NOVO — tabela sessions (UNIQUE token_hash, índice parcial ativo)
apps/api/prisma/migrations/20260818000032_email_verification_tokens/migration.sql: NOVO — tabela email_verification_tokens
apps/api/prisma/migrations/20260818000033_password_reset_tokens/migration.sql: NOVO — tabela password_reset_tokens
apps/api/prisma/migrations/20260818000034_authentication_attempts/migration.sql: NOVO — tabela authentication_attempts (índice email+ip+attempted_at)
apps/api/prisma/schema.prisma: EXPANDIDO — 5 novos models, emailVerified em Identity, relations em User
apps/api/src/platform/config/env.ts: EXPANDIDO — JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, RESEND_API_KEY, FRONTEND_URL
apps/api/src/platform/http/actor-adapter.port.ts: MODIFICADO — resolve() agora async: Promise<ICurrentActor | null>
apps/api/src/platform/http/adapters/development-actor.adapter.ts: MODIFICADO — async resolve()
apps/api/src/platform/http/guards/actor.guard.ts: MODIFICADO — await actorAdapter.resolve()
apps/api/src/platform/http/http.module.ts: SIMPLIFICADO — delega para IdentityModule (imports/exports)
apps/api/src/shared/kernel/actor.types.ts: EXPANDIDO — sessionId?: string opcional
apps/api/src/app.module.ts: EXPANDIDO — importa IdentityModule
apps/api/src/modules/identity/ (NOVO módulo completo):
  domain/entities/ — session.entity.ts, password-credential.entity.ts, auth-attempt.entity.ts
  domain/ports/ — 6 ports (password-hasher, session-repository, token-issuer, email-verification-repository, password-reset-repository, auth-attempt-repository)
  application/use-cases/ — 8 use cases + 6 specs (register, authenticate, refresh, revoke, request-password-reset, reset-password, verify-email, get-current-identity)
  infrastructure/adapters/ — argon-password-hasher.adapter.ts, jwt-token-issuer.adapter.ts, jwt-actor.adapter.ts
  infrastructure/repositories/ — 4 repos Prisma (session, email-verification, password-reset, auth-attempt)
  presentation/controllers/auth.controller.ts — 8 endpoints
  presentation/dtos/ — 6 DTOs (register, login, refresh, forgot-password, reset-password, verify-email)
  identity.module.ts
apps/api/.npmrc: NOVO — pnpm.approvedBuilds para argon2 (prebuild nativo)
package.json + pnpm-lock.yaml: EXPANDIDOS — argon2, @nestjs/jwt, jsonwebtoken, @types/jsonwebtoken

Implementado
Registro: User + Identity(provider=local) + PasswordCredential criados atomicamente. Token de verificação de email gerado e logado (ou enviado via Resend se RESEND_API_KEY presente).
Login: argon2id.verify → session criada → access token JWT (sub=userId, jti=sessionId, 15min) + refresh token (UUID→SHA256, 30d em cookie HttpOnly Secure SameSite=Strict).
Refresh: token rotation — session anterior revogada, nova session + novo refresh token emitidos.
Logout: session revogada pelo sessionId do JWT (jti), cookie limpo.
Reset de senha: token único (SHA256), expiração 1h, single-use, revoga todas as sessions.
Verificação de email: token único, expiração 24h, single-use, marca Identity.emailVerified = true.
JwtActorAdapter: implementa IActorAdapter (async), verifica JWT + session ativa no DB por jti.
Produção: NODE_ENV=production → JwtActorAdapter ativo via IdentityModule. Development → DevelopmentActorAdapter mantido.
Anti-enumeração: login/forgot-password retornam mensagem genérica independente do email existir.
argon2id: memoryCost=65536, timeCost=3, parallelism=4.

Decisões tomadas
IActorAdapter.resolve() tornado async: necessário para JwtActorAdapter consultar DB e verificar se session está ativa (token revogado não autentica). DevelopmentActorAdapter atualizado para async sem alteração de comportamento.
IdentityModule centraliza ACTOR_ADAPTER: evita dependência circular entre HttpModule e IdentityModule. HttpModule simplificado para apenas importar/re-exportar IdentityModule.
Cookies sem @fastify/cookie: leitura manual do header Cookie e escrita via Set-Cookie raw. Evita dependência nova não prevista na tarefa.
emailVerified adicionado na migration 30: incluído junto com password_credentials em vez de migration separada (mesmo batch lógico).
ICurrentActor estendido com sessionId?: JwtActorAdapter retorna sessionId para que AuthController possa revogar a session no logout sem nova query ao banco.
argon2 aprovado via .npmrc pnpm.approvedBuilds: o pacote usa prebuilds nativos; aprovação necessária para o pnpm não bloquear a instalação.

Testes executados
Comando	Resultado
prisma validate	✅ aprovado
tsc --noEmit (typecheck)	✅ aprovado (0 erros)
eslint (lint)	✅ 0 erros novos (6 erros pré-existentes em módulos fora do escopo)
jest (376 testes)	✅ 376/376 aprovados (351 existentes + 25 novos)

Pendências
Testes de integração (Testcontainers com PostgreSQL real) — não executados (sem banco disponível na sessão). Cobrem os fluxos de auth end-to-end.
Envio real de email (RESEND_API_KEY) — quando ausente, tokens são logados em stdout para desenvolvimento local.
Rate limiting de login por IP — complementar ao AuthAttempt já implementado; throttling por infraestrutura é da TASK-057.

Documentação atualizada
docs/CURRENT_STATE.md (TASK-053 marcada como CONCLUÍDA)
.ai/coordination/INTEGRATION_QUEUE.md (TASK-053 marcada como MERGED)

Próxima tarefa recomendada
TASK-054 — Organization Members, Roles & Permissions.
