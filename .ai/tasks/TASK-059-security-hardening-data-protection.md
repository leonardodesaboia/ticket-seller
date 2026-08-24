TASK-059 — Security Hardening & Data Protection

Status: PLANNED

Objetivo

Executar auditoria de segurança em todos os módulos existentes e corrigir falhas encontradas. Categorias: IDOR, cross-tenant isolation, SQL injection em queries brutas, mass assignment, webhook HMAC, token expiry, PII em logs, e dependências com CVEs. Produzir relatório de findings com status de cada item.

Resultado observável

- Relatório `.ai/reports/TASK-059-security-audit.md` com todos os findings, severidade e status (FIXED/ACCEPTED/WON'T FIX).
- Nenhum item CRITICAL ou HIGH sem mitigação ou decisão explícita.
- `pnpm audit --audit-level=high` sem saída (zero vulnerabilidades high ou critical).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados após correções.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-059-security-hardening-data-protection.md
- Todo o código em apps/api/src/modules/ (leitura completa)
- apps/api/src/platform/ (guards, adapters, config)
- apps/api/prisma/schema.prisma
- .github/workflows/ci.yml

Sem migrations de produto (a priori)

Correções de segurança podem requerer alterações de schema (ex: campos faltando NOT NULL, constraints ausentes). Criar migrations se necessário, documentando a razão.

Arquivos permitidos

- Qualquer arquivo em apps/api/src/ que contenha uma falha de segurança identificada.
- apps/api/package.json (para atualização de dependências com CVEs).
- .github/workflows/ci.yml (EXPANDIR — step de pnpm audit).
- .ai/reports/TASK-059-security-audit.md (NOVO — relatório de audit).

Arquivos proibidos

- pnpm-lock.yaml (gerenciado automaticamente pelo pnpm upgrade)
- apps/marketplace-web/ e apps/backoffice-web/ (auditoria focada no backend; frontend fora do escopo desta task)

Categorias de auditoria

1. IDOR (Insecure Direct Object Reference):
   - Verificar: todo endpoint que aceita um ID de entidade (orderId, payoutId, eventId, ticketId, etc.) verifica que a entidade pertence à organização do path (`organizationId` do URL).
   - Método: grep por `findById`, `findOne`, `findUnique` sem acompanhamento de `organizationId` no filter.

2. Cross-tenant isolation:
   - Verificar: toda query Prisma em entidades multi-tenant inclui `organizationId` no WHERE.
   - Método: grep por `prisma.order.findMany({` e similares, verificar presença de `organizationId`.

3. SQL injection:
   - Verificar: todo `$queryRaw` e `$executeRaw` usa template literal Prisma ou parâmetros posicionais.
   - Nunca concatenação de string em query bruta.
   - Método: grep por `$queryRaw` e revisar cada ocorrência.

4. Mass assignment:
   - Verificar: DTOs não expõem campos que deveriam ser definidos pelo servidor (ex: `createdAt`, `organizationId`, `status` em criação).
   - Usar `@Exclude()` ou `class-transformer` para garantir apenas campos explicitamente listados.

5. Webhook HMAC:
   - Verificar: todos os controllers de webhook (pagamento, payout, outros) usam `crypto.timingSafeEqual`.
   - Verificar: secret carregado de ENV, nunca hardcoded.
   - Método: grep por `/webhooks/` em controllers.

6. Token expiry e single-use:
   - Verificar: todos os tokens de verificação/reset criados na TASK-053 têm `expires_at` e `used_at` verificados.
   - Verificar: nenhum token de longa duração sem expiração definida.

7. PII em logs:
   - Verificar: nenhum `this.logger.log(...)` ou `this.logger.debug(...)` inclui email, senha, hash, token.
   - Redact configurado no pino (TASK-058) cobre headers — verificar body logging.

8. Dependency audit:
   - Executar `pnpm audit --audit-level=moderate`.
   - Para cada CVE high/critical: aplicar patch disponível (`pnpm update <package>`) ou documentar mitigação.
   - Não fazer upgrade de major versions sem teste.

9. Suspension check:
   - Verificar: `ActorGuard` consulta `users.suspended_at` e bloqueia acesso se suspenso.
   - Verificar: `OrganizationRoleGuard` consulta `organizations.suspended_at` e bloqueia se suspensa.

Formato do relatório `.ai/reports/TASK-059-security-audit.md`

```markdown
# Security Audit — TASK-059

Data: YYYY-MM-DD

## Resumo
| Severidade | Total | Fixed | Accepted | Won't Fix |
|...

## Findings

### [ID-001] Título do finding
- Severidade: CRITICAL | HIGH | MEDIUM | LOW
- Categoria: IDOR | Cross-tenant | SQL Injection | Mass Assignment | Webhook | Token | PII | Dependency
- Arquivo: apps/api/src/...
- Descrição: o que foi encontrado
- Status: FIXED | ACCEPTED (com mitigação) | WON'T FIX (com justificativa)
- Fix aplicado: [descrever mudança ou "N/A"]
```

Invariantes de correção

- Toda correção de IDOR deve adicionar `organizationId` no filter sem alterar a API pública (transparente para o cliente).
- Nenhuma alteração de interface de use case pública — ajustes apenas na infraestrutura e presentação.
- Dependências atualizadas apenas até o próximo minor/patch — sem major bumps sem teste.

Segurança meta

- `pnpm audit --audit-level=high` passa no CI após esta task.
- `.github/workflows/ci.yml` inclui step de `pnpm audit --audit-level=high` no job de validação.

Fora do escopo

- Penetration testing manual.
- Frontend security (XSS, CSRF — escopo separado).
- Network-level security (VPC, firewall).
- Crypto agility (troca de algoritmo de hash sem re-hash de senhas existentes).

Critérios de aceite

- Relatório produzido com todos os findings categorizados.
- Nenhum CRITICAL ou HIGH com status "aberto" (todos FIXED ou ACCEPTED com mitigação).
- `pnpm audit --audit-level=high` retorna código 0.
- CI inclui step de audit.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` aprovados após correções.

Comandos

```bash
pnpm audit --audit-level=moderate
grep -r '\$queryRaw\|$executeRaw' apps/api/src/ --include='*.ts'
grep -rn 'findMany\|findFirst\|findUnique' apps/api/src/modules/ --include='*.ts' | grep -v 'organizationId'
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
Próxima tarefa: TASK-060 — Production Infrastructure & Deployment.
