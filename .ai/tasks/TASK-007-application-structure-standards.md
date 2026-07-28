# TASK-007 — Application Structure Standards

## Identificador

TASK-007

## Título

Application Structure Standards

## Objetivo

Definir, documentar e aplicar uma arquitetura padronizada de pastas para backend e frontend, criar o pacote de design tokens compartilhado e reorganizar os arquivos existentes sem alterar comportamento observável.

## Status

COMPLETED

## Dependências

TASK-004, TASK-006

## Propriedade exclusiva

- `apps/api/src/**`
- `apps/api/test/**`
- `apps/marketplace-web/src/**`
- `apps/marketplace-web/components.json`
- `packages/design-tokens/**`
- `docs/decisions/ADR-004-application-folder-architecture.md`

## Arquivos permitidos

- `apps/api/src/**`
- `apps/api/test/**`
- `apps/api/tsconfig.json` (somente se necessário)
- `apps/marketplace-web/src/**`
- `apps/marketplace-web/components.json`
- `apps/marketplace-web/package.json` (adicionar design-tokens)
- `packages/design-tokens/**`
- `docs/decisions/ADR-004-application-folder-architecture.md`
- `docs/ARCHITECTURE.md`
- `docs/REPOSITORY_MAP.md`
- `docs/CURRENT_STATE.md`
- `AGENTS.md`

## Arquivos proibidos

- `apps/api/package.json` (nenhuma nova dependência)
- `prisma/**`
- `apps/backoffice-web/**`
- `.github/**`
- `compose.yaml`

## Resultado observável

- API reorganizada em `src/platform/`
- Marketplace reorganizado em `src/shared/`
- Pacote `packages/design-tokens/` criado
- Marketplace consumindo tokens via `@import`
- `@theme inline` mapeando utilities Tailwind
- shadcn/ui Button funcionando
- ADR-004 criado
- Todos os testes passando
- Lint, typecheck e build aprovados

## Critérios de aceite

- [ ] Nenhum arquivo vazio sem uso
- [ ] Nenhuma funcionalidade de negócio criada
- [ ] Comportamento existente preservado
- [ ] GET /api/v1/health/live → 200
- [ ] GET /api/v1/health/ready → 200
- [ ] Swagger funcionando
- [ ] Página inicial marketplace funcionando
- [ ] Design tokens centralizados no pacote
- [ ] Utilities Tailwind semânticas funcionando
- [ ] pnpm lint → PASS
- [ ] pnpm typecheck → PASS
- [ ] pnpm test → PASS
- [ ] pnpm build → PASS

## Comandos de validação

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Formato de conclusão

Relatório em `.ai/reports/TASK-007-application-structure-standards.md`
