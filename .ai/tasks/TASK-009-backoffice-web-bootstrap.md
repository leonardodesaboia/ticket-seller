# TASK-009 — Backoffice Web Bootstrap

## Identificador

TASK-009

## Título

Backoffice Web Bootstrap

## Objetivo

Criar a aplicação Next.js do backoffice administrativo, seguindo a mesma arquitetura de pastas definida pela TASK-007, consumindo os design tokens compartilhados e sem implementação antecipada de funcionalidades de negócio.

## Status

COMPLETED

## Dependências

TASK-007

## Propriedade exclusiva

- `apps/backoffice-web/**`

## Arquivos proibidos

- `apps/marketplace-web/**`
- `apps/api/**`
- `packages/**`
- `.github/**`

## Resultado observável

- Aplicação Next.js 15 rodando em porta 3002
- Consumindo `@ticket-seller/design-tokens`
- Estrutura de pastas: app/, features/, shared/
- Primitivo Button funcional com tokens semânticos
- Cliente de API centralizado (stub)
- Testes passando

## Critérios de aceite

- [ ] Estrutura: app/, features/ (vazia), shared/api/, shared/lib/, shared/ui/primitives/
- [ ] Layout raiz com lang="pt-BR"
- [ ] Página inicial placeholder (sem dados de negócio)
- [ ] loading.tsx, error.tsx, not-found.tsx
- [ ] globals.css importando design-tokens
- [ ] api-client.ts centralizado
- [ ] Button primitivo usando tokens semânticos
- [ ] pnpm lint → PASS
- [ ] pnpm typecheck → PASS
- [ ] pnpm test → PASS
- [ ] pnpm build → PASS

## Comandos de validação

```bash
pnpm --filter @ticket-seller/backoffice-web lint
pnpm --filter @ticket-seller/backoffice-web typecheck
pnpm --filter @ticket-seller/backoffice-web test
pnpm --filter @ticket-seller/backoffice-web build
```

## Formato de conclusão

Relatório em `.ai/reports/TASK-009-backoffice-web-bootstrap.md`
