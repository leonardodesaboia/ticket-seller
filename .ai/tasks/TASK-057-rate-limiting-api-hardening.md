TASK-057 — Rate Limiting, Abuse Prevention & API Hardening

Status: PLANNED

Objetivo

Aplicar rate limiting granular via @nestjs/throttler com Redis store, ativar @fastify/helmet com CSP completo, restringir CORS (remover wildcard em production), limitar tamanho de body, e proteger endpoints sensíveis de abuso. Sem novas migrations.

Resultado observável

- `POST /auth/login` retorna 429 após 5 tentativas em 15min do mesmo IP+email.
- `POST /auth/forgot-password` retorna 429 após 3 tentativas em 1h.
- Resposta inclui headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Resposta inclui headers de segurança: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.
- `CORS_ORIGINS=*` em `NODE_ENV=production` → erro na inicialização da aplicação.
- Body JSON > 1MB → 413.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-057-rate-limiting-api-hardening.md
- apps/api/src/main.ts
- apps/api/src/platform/config/env.ts
- apps/api/src/app.module.ts
- apps/api/package.json

Sem migrations

Esta task não altera o schema de banco de dados.

Arquivos permitidos

Backend:
- apps/api/src/main.ts (EXPANDIR — helmet, cors restrito, body limit)
- apps/api/src/app.module.ts (EXPANDIR — ThrottlerModule com Redis store)
- apps/api/src/platform/config/env.ts (EXPANDIR — REDIS_URL, validação CORS_ORIGINS)
- apps/api/src/platform/http/decorators/throttle.decorator.ts (NOVO — wrappers tipados sobre @Throttle)
- apps/api/src/modules/identity/presentation/controllers/auth.controller.ts (EXPANDIR — apply throttle decorators)

Arquivos proibidos

- apps/api/prisma/ (sem migrations)
- apps/api/src/modules/finance/ (sem alterações)
- pnpm-lock.yaml

Packages novos

```
@nestjs/throttler
ioredis
@nestjs-throttler-storage-redis (ou nestjs-throttler-storage-redis)
```

Variáveis de ambiente novas/alteradas

```
REDIS_URL           string, opcional (fallback para in-memory throttler se ausente)
CORS_ORIGINS        string, agora obrigatório em NODE_ENV=production; não pode ser '*'
```

Requisitos funcionais

1. Throttler global:
   - ThrottlerModule.forRootAsync com Redis store se REDIS_URL definido, senão in-memory.
   - Default global: 200 requests/1min por IP.
   - Storage Redis usa REDIS_URL.

2. Rate limits por rota (via decorators em controllers):

| Rota | Limite | Janela | Chave |
|------|--------|--------|-------|
| POST /auth/login | 5 | 15min | IP + email do body |
| POST /auth/forgot-password | 3 | 1h | IP + email do body |
| POST /auth/register | 10 | 1h | IP |
| POST /auth/refresh | 20 | 5min | IP |
| POST /invitations/:token/accept | 10 | 1h | IP |
| POST /reservations | 20 | 1min | userId |
| POST /payments | 10 | 5min | userId |
| POST /webhooks/* | Sem limite | — | Excluir de throttling global |

3. Helmet no `main.ts`:
   ```
   helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],
         imgSrc: ["'self'", "data:", "https:"],
         connectSrc: ["'self'"],
         frameSrc: ["'none'"],
       },
     },
     hsts: { maxAge: 31536000, includeSubDomains: true },
     frameguard: { action: 'deny' },
     noSniff: true,
     referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
   })
   ```

4. CORS restrito:
   - `CORS_ORIGINS` é uma string de origens separadas por vírgula.
   - Em `NODE_ENV=production`: validar que não contém '*' (erro na startup se contiver).
   - Cors com: `origin: allowedOrigins, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']`.

5. Body limit:
   - Fastify: `bodyLimit: 1_048_576` (1MB) globalmente.
   - Rota `/organizations/*/events/*/cover/upload-url`: não recebe body de arquivo (apenas JSON do tipo) — sem exceção necessária.

6. Cabeçalhos de rate limit:
   - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` nas respostas.
   - `Retry-After` em respostas 429.

Invariantes

- Webhooks de PSP nunca sofrem rate limiting (excluir explicitamente via decorator @SkipThrottle).
- Rate limits de auth (login, forgot-password) usam chave composta IP + email — não apenas IP.
- REDIS_URL ausente → in-memory throttler funciona (sem Redis obrigatório em development).

Segurança

- CORS_ORIGINS=* em production é erro de configuração fatal (aplicação não sobe).
- Helmet aplicado antes de qualquer handler.
- Rate limit de login deve ser consistente com lógica de AuthAttempt do TASK-053 (complementar, não substituto).

Fora do escopo

- DDoS mitigation em camada de infraestrutura (Cloudflare, WAF).
- Blocklist de IPs persistente.
- Captcha.
- Adaptive rate limiting por reputação.

Critérios de aceite

- 6ª tentativa de login no mesmo IP+email em 15min → 429 com Retry-After.
- Headers de segurança presentes em todas as respostas.
- CORS_ORIGINS=* em production → aplicação falha ao iniciar com mensagem clara.
- Body de 2MB → 413.
- Webhook endpoint não retorna 429 sob carga normal.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api add @nestjs/throttler ioredis
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-058 — Observability, Reliability & Operational Alerts.
