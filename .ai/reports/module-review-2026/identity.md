# Revisão de Módulo — identity

**Data:** 2026-08-24  
**Revisor:** Claude Sonnet 4.6 (análise automatizada)  
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

O módulo `identity` está em bom estado geral (argon2id, token rotation atômica, throttle). Foram identificados **2 críticos**, **5 altos**, **8 médios** e **6 baixos**. O bug mais grave é o **cookie path errado** que impede browsers de enviar o refresh token automaticamente, quebrando o fluxo de refresh em produção. O segundo crítico é a **escrita de tokens brutos em stdout** quando `RESEND_API_KEY` não está configurado, inclusive em produção.

---

## Problemas por Severidade

### CRÍTICO

#### C1 — `auth.controller.ts:209,223`: Cookie `Path=/auth` incompatível com global prefix `/api/v1`
- **Arquivo:** `apps/api/src/modules/identity/presentation/controllers/auth.controller.ts`
- **Problema:** `main.ts` configura global prefix `/api/v1`. Browsers só enviam o cookie em paths que começam com o atributo `Path`. `/api/v1/auth/refresh` não começa com `/auth`, então o cookie `refresh_token` **nunca é enviado automaticamente** por browsers em produção — fluxo de refresh silenciosamente quebrado.
- **Correção:** Mudar `Path=/auth` para `Path=/api/v1/auth` em `setRefreshTokenCookie` e `clearRefreshTokenCookie`.
- **Status:** PENDENTE

#### C2 — `register-with-password.use-case.ts:82`, `request-password-reset.use-case.ts:41`: Tokens brutos em stdout em produção
- **Problema:** A condição é `!RESEND_API_KEY`, não `NODE_ENV !== 'production'`. Se produção for deployada sem `RESEND_API_KEY`, tokens de verificação de email (24h) e reset de senha (1h) ficam em logs, permitindo acesso não autorizado a qualquer conta.
- **Correção:** Adicionar `else if (env.NODE_ENV !== 'production')` antes de escrever no stdout.
- **Status:** PENDENTE

---

### ALTO

#### A1 — `register-with-password.use-case.ts:30-41`: TOCTOU — P2002 vira HTTP 500
- **Problema:** `findUnique` seguido de `$transaction`. Requisições concorrentes com o mesmo email passam pelo check e tentam INSERT. O P2002 resultante não é capturado e vira 500 em vez de 409 Conflict.
- **Correção:** Envolver `$transaction` em try/catch para P2002 e converter para `ConflictException`.

#### A2 — `authenticate-with-password.use-case.ts:70-88`: Timing side-channel para enumeração de emails
- **Problema:** Email inexistente → ~5ms (sem argon2). Email errado → ~155ms (com argon2). Atacante distingue emails válidos por timing.
- **Correção:** Executar `hasher.verify` dummy quando identity não for encontrado para equalizar tempo de resposta.

#### A3 — `refresh-session.use-case.ts:27-43`: Sem fallback se `create` falhar após `rotateByTokenHash`
- **Problema:** `rotateByTokenHash` revoga sessão atomicamente. Se `sessionRepository.create` falhar depois, usuário perde acesso sem nova sessão criada.
- **Correção:** No `catch` do `create`, logar contexto crítico (userId) e retornar 503 em vez de 500.

#### A4 — `prisma-auth-attempt.repository.ts`: Index `[email, ip, attemptedAt]` não cobre query por `ip`
- **Problema:** `countRecentFailures` executa query por `ip` sozinho. B-tree index composto não é usado sem as colunas mais à esquerda — resulta em sequential scan na tabela.
- **Correção:** Adicionar `@@index([ip, attemptedAt(sort: Desc)])` no schema.

#### A5 — Violação de camada: 4 use cases injetam `PrismaService` diretamente
- **Problema:** `authenticate-with-password`, `register-with-password`, `request-password-reset` e `get-current-identity` injetam `PrismaService` na camada de aplicação, quebrando ports & adapters. Não testáveis sem mock completo do Prisma.
- **Correção:** Criar ports `IUserRepository`, `IIdentityRepository`, `IPasswordCredentialRepository` com adapters Prisma.

---

### MÉDIO

#### M1 — `auth.controller.ts:219-226`: `clearRefreshTokenCookie` sem flag `Secure` em produção
- **Problema:** `setRefreshTokenCookie` adiciona `; Secure` em produção. `clearRefreshTokenCookie` não. Browser pode ignorar o clear em HTTPS.
- **Correção:** Extrair lógica de `secure` e aplicar em ambos.

#### M2 — `register-with-password.use-case.ts:76-80`: `emailVerificationRepository.create` fora da transação
- **Problema:** Se `create` falhar após `$transaction` de criação de usuário, usuário existe sem token de verificação — estado inconsistente sem mecanismo de recovery.
- **Correção:** Incluir criação do token dentro da transação Prisma.

#### M3 — `authenticate-with-password.use-case.ts:60-68`: Usuário soft-deleted consegue autenticar
- **Problema:** Query não filtra por `user.deletedAt`. Usuários soft-deleted passam pelo login normalmente.
- **Correção:** Adicionar `user: { where: { deletedAt: null } }` ao select.

#### M4 — `authenticate-with-password.use-case.ts`: `forceReset=true` nunca verificado durante login
- **Problema:** Campo `forceReset` em `PasswordCredential` existe mas não é lido. Usuários com força de reset conseguem autenticar normalmente.
- **Correção:** Após validar senha, verificar `credential.forceReset` e retornar código `FORCE_PASSWORD_RESET`.

#### M5 — `prisma-session.repository.ts:27-43`: `findActive*` retorna sessões inativas
- **Problema:** Nome semanticamente errado — retorna sessões revogadas/expiradas. Chamador futuro que esqueça de verificar `revokedAt` introduzirá vulnerabilidade.
- **Correção:** Adicionar filtros `revokedAt: null` e `expiresAt > NOW()` na query, ou renomear para `findByTokenHash`.

#### M6 — `prisma-password-reset.repository.ts`: `markUsed` + `updateCredentialHash` sem transação
- **Problema:** Se `updateCredentialHash` falhar após `markUsed`, token é consumido mas senha não é alterada — estado inconsistente.
- **Correção:** Executar ambos dentro de `$transaction`.

#### M7 — `refresh-session.use-case.ts:38-42`: Sessão renovada perde IP/UserAgent
- **Problema:** `sessionRepository.create` não inclui `ip` nem `userAgent`. Rastreabilidade de auditoria perdida.
- **Correção:** Passar `ip` e `userAgent` via `RefreshSessionInput` (controller já tem acesso via `req.ip`).

#### M8 — `verify-email.dto.ts`: `token` sem `@MaxLength`
- **Correção:** `@MaxLength(256)`.

---

### BAIXO

#### B1 — `identity.module.ts:45`: Fallback JWT secret com string literal hardcoded desnecessário
- **Problema:** Fallback `'dev-secret-not-for-production-at-all'` nunca é alcançado em produção (env.ts já lança erro), mas é enganoso.
- **Correção:** Usar `env.JWT_SECRET!` com comentário explicando por que a asserção é segura.

#### B2 — `jwt-token-issuer.adapter.ts`: Algoritmo HS256 não configurado explicitamente
- **Correção:** Adicionar `signOptions: { algorithm: 'HS256' }` e `verifyOptions: { algorithms: ['HS256'] }`.

#### B3 — `auth.controller.ts:189-199`: Parsing manual de cookie sem `@fastify/cookie`
- **Correção:** Registrar `@fastify/cookie` no `main.ts` e usar `req.cookies['refresh_token']`.

#### B4 — `forgot-password.dto.ts`: Email sem `@MaxLength(320)`
#### B5 — `reset-password.dto.ts`: Token `@MaxLength(256)` muito permissivo para UUID de 36 chars
#### B6 — `auth.controller.ts:132`: `logout` sem aviso quando `sessionId` é undefined em dev

---

## Correções Implementadas

**2026-08-24 — Sessão 2 e 3**

| ID | Correção | Arquivo |
|---|---|---|
| C1 | Cookie `Path` corrigido de `/auth` para `/api/v1/auth` em `setRefreshTokenCookie` e `clearRefreshTokenCookie`. | `auth.controller.ts` |
| C2 | `register-with-password`: guarda `else if (env.NODE_ENV !== 'production')` adicionada antes do `process.stdout.write`. `request-password-reset` já estava correto. | `register-with-password.use-case.ts` |
| M3 | `authenticate-with-password`: query filtrada por `deletedAt: null` e `suspendedAt: null`. | `authenticate-with-password.use-case.ts` |
| A5 | Layer violation corrigida: criado `IUserRepository` port + `PrismaUserRepository` adapter. Quatro use cases (`authenticate-with-password`, `register-with-password`, `request-password-reset`, `get-current-identity`) agora injetam o port. Specs atualizadas. | `user.repository.port.ts`, `prisma-user.repository.ts`, 4 use-cases, 2 specs |

**Pendente e corrigido:**
- ~~A1: TOCTOU em P2002~~ — **FALSO POSITIVO**: `prisma-user.repository.ts:110` já captura `P2002` e relança `ConflictException` → HTTP 409
- ~~A2: Timing side-channel para enumeração de emails~~ — **FALSO POSITIVO**: `authenticate-with-password.use-case.ts:63` já faz `hasher.verify(dummy, ...)` quando identity não encontrado
- ~~A3: Sem fallback se `sessionRepository.create` falhar após `rotateByTokenHash`~~ — **CORRIGIDO 2026-08-25**: `refresh-session.use-case.ts` envolve `sessionRepository.create` em try/catch; falha lança `ServiceUnavailableException` com log CRITICAL do `userId` afetado. Spec atualizado com teste do cenário de falha.
- ~~A4: Index `[ip, attemptedAt]` faltando em `auth_attempts`~~ — **CORRIGIDO 2026-08-25**: `@@index([ip, attemptedAt(sort: Desc)])` adicionado ao model `AuthenticationAttempt` em `schema.prisma`. Garante que a query por `ip` em `countRecentFailures` use index scan.
- ~~M1: `clearRefreshTokenCookie` sem flag `Secure` em produção~~ — **FALSO POSITIVO**: `auth.controller.ts:220` já adiciona `Secure` no clear cookie
- ~~M2: `emailVerificationRepository.create` fora da transação de registro~~ — **CORRIGIDO 2026-08-25**: `RegisterUserInput` agora aceita `emailVerificationToken?: { tokenHash; expiresAt }`. `PrismaUserRepository.register` cria o token atomicamente dentro da mesma `$transaction`. Use case não injeta mais `IEmailVerificationRepository`; spec atualizado.
- ~~M4: `forceReset` flag nunca verificado durante login~~ — **CORRIGIDO 2026-08-25**: `IdentityWithCredential` agora inclui `forceReset: boolean`. `findIdentityWithCredential` seleciona `forceReset` do `PasswordCredential`. `AuthenticateWithPasswordOutput` inclui `mustResetPassword: boolean`. Sessão ainda é criada — o cliente redireciona para reset. Spec atualizado com 1 novo teste.
- ~~M5: `findActive*` retorna sessões inativas~~ — **CORRIGIDO 2026-08-25**: `findActiveByTokenHash` e `findActiveById` em `prisma-session.repository.ts` agora usam `findFirst` com `revokedAt: null, expiresAt: { gte: new Date() }`. Métodos agora retornam apenas sessões realmente ativas.
- ~~M6: `markUsed` + `updateCredentialHash` sem transação~~ — **CORRIGIDO 2026-08-25**: novo método `resetPasswordAtomically` no port + repository (Prisma transaction array). `reset-password.use-case.ts` atualizado para usar método atômico.
- ~~M7: Sessão renovada perde IP/UserAgent~~ — **CORRIGIDO 2026-08-25**: `RefreshSessionInput` agora tem `ip` e `userAgent`; controller extrai e passa; `sessionRepository.create` já aceitava os campos opcionais.
- B2: Algoritmo HS256 não configurado explicitamente no JWT
