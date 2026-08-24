ADR-007 — Autenticação própria com email/senha, JWT e refresh token rotation

Status

ACCEPTED

Data

2026-08-18

Contexto

O sistema opera com `DevelopmentActorAdapter`, que lê o header `X-Dev-User-Id` e retorna null em production. Não existe nenhum substituto de produção: sem sessions, sem password_credentials, sem JWT. Isso é o maior blocker de produção identificado (TASK-053).

O sistema precisa de:

1. Um mecanismo de autenticação real compatível com a abstração `IActorAdapter` já existente.
2. Suporte a fluxos de registro, login, reset de senha e verificação de email.
3. Possibilidade de adicionar OAuth/OIDC no futuro sem reescrever a base.

Foram avaliadas as seguintes opções:

**A — Auth próprio (email + senha + JWT)**
- argon2id para hashing de senha
- JWT access token (15min, Bearer header) + refresh token opaco (30 dias, HttpOnly cookie)
- `JwtActorAdapter` implementa `IActorAdapter` existente
- Sem dependência de SaaS externo

**B — Clerk**
- SaaS de autenticação, integração via JWT/webhook
- Alta velocidade de implementação
- Billing externo; acoplamento de vendor

**C — Auth0**
- SaaS OIDC padrão
- Mais flexível, mais complexo, billing externo

**D — Supabase Auth**
- Integrado ao Supabase PostgreSQL
- Acopla ao ecossistema Supabase

Decisão

**Opção A — Auth próprio com email/senha, JWT e refresh token rotation.**

Detalhes técnicos:

**Hashing**: argon2id com `{ memoryCost: 65536, timeCost: 3, parallelism: 4 }`. Resistente a ataques GPU.

**Access token**: JWT assinado com `JWT_SECRET` (HMAC-SHA256). Payload: `{ sub: userId, jti: sessionId, iat, exp }`. Expiração: 15min. Transmitido como Bearer no header `Authorization`.

**Refresh token**: UUID v4 → SHA-256 hex armazenado em `sessions.token_hash`. Token bruto retornado ao cliente via cookie `HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000`. Expiração: 30 dias.

**Token rotation**: ao usar refresh token, a session anterior é revogada (`revoked_at = now()`) e uma nova session é criada com novo token. Roubo de refresh token detectável se token rotacionado for reutilizado.

**JwtActorAdapter**: implementa `IActorAdapter`. Lê Bearer do header, verifica JWT, busca session por `jti`. Retorna `{ userId: payload.sub }` ou null. Registrado em `HttpModule` via factory: production → JwtActorAdapter, development → DevelopmentActorAdapter.

**Anti-enumeração**: login, registro e reset-senha retornam mensagens genéricas independente do email existir.

**MFA**: adiado para pós-MVP. A abstração `IPasswordHasherPort` e `ITokenIssuerPort` permitem adicionar TOTP sem alterar use cases.

**OIDC futuro**: um segundo adapter (ex: `GoogleOidcActorAdapter`) pode implementar `IActorAdapter` e ser disponível como provider alternativo sem alterar o domínio.

Razões

sem dependência de SaaS externo — sem billing, sem vendor lock;
abstração `IActorAdapter` já existente absorve o novo adapter sem alterar guards ou use cases existentes;
argon2id é o algoritmo recomendado pelo OWASP e winner do Password Hashing Competition;
refresh token rotation é superior a refresh sem rotation (roubo detectável);
cookie HttpOnly elimina risco de XSS roubando refresh token;
OIDC pode ser adicionado depois como adapter adicional — não requer reescrita.

Consequências positivas

controle total sobre dados de autenticação (sem dependência de terceiros);
possibilidade de auditoria completa de sessions (active_sessions por usuário);
integração natural com a tabela `users` já existente;
add-on de TOTP ou WebAuthn sem reescrita de base;
zero billing adicional.

Consequências negativas

responsabilidade pela segurança do fluxo de autenticação é do time;
argon2 tem custo de CPU por login — aceitável com o volume alvo do MVP (< 100 usuários ativos);
rotação de refresh token requer persistência de sessions no banco (query a cada request autenticada via `jti`);
sem magic links, social login, ou passkeys no MVP.

Alternativas rejeitadas

**Clerk / Auth0 / Supabase Auth**: rejeitados por introduzir billing externo e acoplamento de vendor sem benefício proporcional para o MVP. A abstração IActorAdapter permite adicioná-los depois como adapter alternativo se necessário.

Impactos

Código:
- Novo módulo `apps/api/src/modules/identity/` com 8 use cases e 4 ports.
- `HttpModule` atualizado para registrar JwtActorAdapter em production.
- 5 novas migrations de schema.

Infraestrutura:
- `JWT_SECRET` obrigatório em production (mínimo 32 chars, recomendado 64 chars gerado com `openssl rand -hex 32`).
- Sem infraestrutura adicional — sessions armazenadas no PostgreSQL existente.

Segurança:
- `JWT_SECRET` não pode ser commitado — carregado via ENV ou secrets manager.
- Sessions expiradas/revogadas devem ser limpadas periodicamente (cleanup job — fora do escopo do MVP; índice em `expires_at` garante que queries não degradam).

Migração ou reversão

Para adicionar OIDC futuro: implementar `OidcActorAdapter implements IActorAdapter`, registrar em `HttpModule` como alternativa.
Para adicionar TOTP: adicionar `totp_credentials` table, verificar TOTP no `AuthenticateWithPasswordUseCase` antes de criar session.
Para migrar para provider externo: implementar `ExternalProviderActorAdapter`, manter sessions locais como backup ou delegar totalmente.

Referências

TASK-053 — Production Authentication & Sessions
OWASP Password Storage Cheat Sheet — argon2id recomendado
RFC 6750 — Bearer Token Usage
RFC 9449 — OAuth 2.0 DPoP (considerado para versão futura)
