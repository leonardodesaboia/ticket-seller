# Relatório — TASK-007 — Application Structure Standards

Data: 2026-07-28

Status: CONCLUÍDA

## Resultado

Arquitetura de pastas padronizada, documentada e aplicada. API reorganizada em `platform/`. Marketplace reorganizado em `shared/`. Pacote de design tokens criado e consumido. Todos os testes passando, lint e typecheck aprovados, builds aprovados.

## Arquivos alterados

### Criados

| Arquivo | Descrição |
|---------|-----------|
| `packages/design-tokens/package.json` | Pacote de design tokens |
| `packages/design-tokens/tokens.css` | Tokens primitivos e semânticos (light + dark) |
| `apps/api/src/platform/config/env.ts` | env.ts movido para platform/config/ |
| `apps/api/src/platform/http/filters/http-exception.filter.ts` | Filtro RFC 9457 movido para platform/http/filters/ |
| `apps/api/src/platform/health/health.controller.ts` | Health controller movido para platform/health/ |
| `apps/api/src/platform/health/health.module.ts` | Health module movido para platform/health/ |
| `apps/api/test/e2e/health.e2e-spec.ts` | Teste movido para test/e2e/ com imports atualizados |
| `apps/marketplace-web/src/shared/lib/utils.ts` | utils.ts (cn) movido para shared/lib/ |
| `apps/marketplace-web/src/shared/api/api-client.ts` | api-client.ts movido para shared/api/ |
| `apps/marketplace-web/src/shared/ui/primitives/button.tsx` | Button movido para shared/ui/primitives/ |
| `docs/decisions/ADR-004-application-folder-architecture.md` | Decisão arquitetural registrada |

### Removidos

| Arquivo | Motivo |
|---------|--------|
| `apps/api/src/config/env.ts` | Movido para platform/config/ |
| `apps/api/src/common/filters/http-exception.filter.ts` | Movido para platform/http/filters/ |
| `apps/api/src/health/health.controller.ts` | Movido para platform/health/ |
| `apps/api/src/health/health.module.ts` | Movido para platform/health/ |
| `apps/api/test/health.e2e-spec.ts` | Movido para test/e2e/ |
| `apps/marketplace-web/src/lib/utils.ts` | Movido para shared/lib/ |
| `apps/marketplace-web/src/lib/api-client.ts` | Movido para shared/api/ |
| `apps/marketplace-web/src/components/ui/button.tsx` | Movido para shared/ui/primitives/ |

### Atualizados

| Arquivo | Mudança |
|---------|---------|
| `apps/api/src/main.ts` | Imports atualizados para platform/ |
| `apps/api/src/app.module.ts` | Import HealthModule atualizado para platform/ |
| `apps/marketplace-web/src/app/globals.css` | Tokens extraídos para pacote; @theme inline adicionado |
| `apps/marketplace-web/components.json` | Aliases atualizados para shared/ |
| `apps/marketplace-web/package.json` | @ticket-seller/design-tokens adicionado |
| `AGENTS.md` | Seção 5 atualizada com estrutura de pastas |
| `docs/ARCHITECTURE.md` | Seção de estrutura de pastas adicionada |
| `docs/REPOSITORY_MAP.md` | Mapa completo atualizado |
| `docs/CURRENT_STATE.md` | TASK-007 marcada como concluída |

### Corrigido

| Item | Descrição |
|------|-----------|
| `.ai/scripts/validade-migrations.sh` | Renomeado para `validate-migrations.sh` (typo corrigido) |

## Testes executados

| Comando | Resultado |
|---------|-----------|
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 4 testes (2 API e2e, 2 marketplace unit) |
| `pnpm build` | PASS — API tsc + Next.js static |

## Decisões tomadas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Localização do tokens.css | Raiz do pacote (não em src/) | CSS imports não passam pelo exports map do Node.js — o arquivo precisa estar acessível diretamente pelo path |
| @theme inline em globals.css | Mapeamento explícito de `--color-*` | Tailwind CSS 4 exige mapeamento explícito no @theme para gerar utilities semânticas como bg-primary |
| Tokens success/warning/info | Adicionados com valores razoáveis | Tokens ausentes no estado anterior; necessários para o sistema ser completo |
| Granularidade das migrations (TASK-007) | Não criadas nesta tarefa | Pertence à TASK-008 |

## Riscos observados

| Risco | Status |
|-------|--------|
| `ring-offset-background` no button.tsx (Tailwind v3 vs v4) | Aceito — build passa, comportamento visual a verificar |
| Aviso `next lint` deprecated | Aceito — não afeta build nem testes; será tratado em TASK-010 (CI) |
| Aviso Next.js sobre múltiplos lockfiles | Aceito — comportamento do ambiente; não afeta CI |

## Pendências

Nenhuma pendência bloqueante. Aviso de `ring-offset-background` pode ser avaliado quando o design system estiver mais maduro.
