TASK-062 — Release Readiness & E2E Certification

Status: PLANNED

Objetivo

Executar o checklist completo de release readiness: fechar todos os blockers de produção abertos, executar a matrix de testes E2E, validar o fluxo completo em staging, realizar load test controlado, e assinar o release candidate. Esta task não adiciona features — somente valida e fecha gaps.

Resultado observável

- Checklist de release em `docs/release/RC-1.0.md` com todos os itens verificados.
- Todos os blockers de produção da seção 13 do plano: status CLOSED.
- `pnpm audit --audit-level=high` retorna 0 vulnerabilidades.
- TypeScript typecheck passing nos três apps.
- Todos os Dockerfiles fazem build com sucesso.
- Health endpoints respondendo corretamente em staging.
- Fluxo completo de compra testado em staging com sandbox do PSP.
- `pnpm test` e `pnpm test:integration` passam (100% dos testes existentes).

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-062-release-readiness-e2e-certification.md
- docs/release/RC-1.0.md (a ser criado nesta task)
- .ai/reports/TASK-059-security-audit.md (resultado da auditoria de segurança)
- apps/api/src/platform/config/env.ts (lista de variáveis)
- docs/configuration.md (criado na TASK-060)

Sem código novo

Esta task apenas fecha gaps identificados nas tasks anteriores e documenta o release candidate. Se gaps forem encontrados, corrigi-los é parte do escopo desta task.

Arquivos permitidos

- docs/release/ (NOVA pasta)
  - RC-1.0.md (checklist de release candidate)
- Qualquer arquivo identificado como gap durante a verificação

Checklist de release (RC-1.0.md)

O documento deve conter cada item abaixo com status [✅ DONE | ❌ BLOCKED | ⚠️ ACCEPTED]:

### Autenticação e Sessões (TASK-053)
- [ ] POST /auth/register funciona
- [ ] POST /auth/login retorna access + refresh token
- [ ] Token expirado → 401
- [ ] Token revogado → 401
- [ ] JwtActorAdapter ativo em production (NODE_ENV=production)
- [ ] DevelopmentActorAdapter inativo em production

### Membros e Roles (TASK-054)
- [ ] Convite por email funciona end-to-end
- [ ] Aceitação de convite cria OrganizationMember
- [ ] Proteção de último OWNER ativa (422 ao tentar remover/downgrade)
- [ ] OrganizationRoleGuard rejeita membro sem capability

### Platform Admin (TASK-055)
- [ ] Rotas /admin/* exigem platform_role
- [ ] Suspend/unsuspend registra AuditEntry
- [ ] Organização suspensa → 403 para membros

### Uploads (TASK-056)
- [ ] presigned URL gerada com content-type restrito
- [ ] Confirm valida arquivo via headObject
- [ ] MinIO funciona em development

### Rate Limiting (TASK-057)
- [ ] Login rate limit: 5/15min por IP+email → 429
- [ ] Helmet headers presentes em todas as respostas
- [ ] CORS rejeita origens não listadas em production
- [ ] Body > 1MB → 413

### Observabilidade (TASK-058)
- [ ] X-Request-Id propagado em todos os logs
- [ ] GET /health/live → 200 sempre
- [ ] GET /health/ready → 503 se DB indisponível

### Segurança (TASK-059)
- [ ] pnpm audit --audit-level=high: 0 findings
- [ ] Nenhum CRITICAL/HIGH sem mitigação no relatório
- [ ] IDOR checks em todos os endpoints auditados
- [ ] SQL injection: sem concatenação em $queryRaw

### Infraestrutura (TASK-060)
- [ ] docker build apps/api: sucesso
- [ ] docker build apps/marketplace-web: sucesso
- [ ] docker build apps/backoffice-web: sucesso
- [ ] docs/configuration.md completo

### Backup e Runbooks (TASK-061)
- [ ] docs/operations/backup-strategy.md criado
- [ ] 6 runbooks criados em docs/runbooks/
- [ ] Procedimento de restore testado em ambiente isolado

### Qualidade de código
- [ ] pnpm --filter @ticket-seller/api typecheck: 0 erros
- [ ] pnpm --filter @ticket-seller/marketplace-web typecheck: 0 erros
- [ ] pnpm --filter @ticket-seller/backoffice-web typecheck: 0 erros
- [ ] pnpm --filter @ticket-seller/api lint: 0 erros novos
- [ ] pnpm --filter @ticket-seller/api test: 100% passing
- [ ] pnpm --filter @ticket-seller/api test:integration: 100% passing

### E2E Matrix (em staging ou ambiente integrado)

Fluxo principal:
- [ ] Criar conta → verificar email → login → criar organização → criar evento → publicar → comprar ingresso → emitir ingresso → fazer check-in → solicitar payout
- [ ] Reembolso: comprar → reembolsar → saldo atualizado corretamente
- [ ] Cancelamento de evento: criar → publicar → cancelar → reembolsos em massa disparados
- [ ] Transferência de ingresso: comprar → transferir → aceitar transferência → check-in com novo titular
- [ ] Chargeback: criar order confirmada → processar chargeback → ledger atualizado

Testes de concorrência:
- [ ] Overselling: 10 requests simultâneos de reserva para estoque de 1 → apenas 1 aprovado
- [ ] Duplicate payout: 2 requests simultâneos de payout com mesmo idempotency_key → apenas 1 processado

### Load test (k6 ou Artillery, em staging)
- [ ] 50 usuários simultâneos por 5min: P95 < 500ms, P99 < 2s, error rate < 1%
- [ ] Resultado documentado em docs/release/load-test-results.md

### Variáveis de ambiente de production verificadas
- [ ] JWT_SECRET definido (mínimo 32 chars)
- [ ] DATABASE_URL apontando para banco de produção
- [ ] REDIS_URL definido
- [ ] CORS_ORIGINS sem wildcard
- [ ] RESEND_API_KEY definido
- [ ] FAKE_PAYOUT_SECRET definido
- [ ] OBJECT_STORAGE_PROVIDER=s3 (ou minio para staging)

Critérios de aceite para release

- Todos os itens do checklist com status ✅ DONE ou ⚠️ ACCEPTED (com mitigação documentada).
- Zero itens ❌ BLOCKED.
- Relatório de load test dentro dos thresholds.
- RC-1.0.md assinado pelo responsável técnico.

Fora do escopo

- Migração de dados de produção existente (produto novo, sem dados legados).
- Testes de acessibilidade aprofundados (WCAG 2.1 AA — pós-MVP).
- Testes de segurança avançados (pentesting profissional, bug bounty).
- Performance de frontend (Core Web Vitals detalhados — pós-MVP).

Comandos

```bash
pnpm audit --audit-level=high
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/marketplace-web typecheck
pnpm --filter @ticket-seller/backoffice-web typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration
docker build -f apps/api/Dockerfile . -t ticket-seller-api:rc1
docker build -f apps/marketplace-web/Dockerfile . -t ticket-seller-marketplace:rc1
docker build -f apps/backoffice-web/Dockerfile . -t ticket-seller-backoffice:rc1
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [todos os comandos acima]: aprovado
Release candidate: RC-1.0 — READY | NOT READY
Pendências: [pendência ou "Nenhuma — produto pronto para release"]
Próxima tarefa: Nenhuma — RC-1.0 entregue.
