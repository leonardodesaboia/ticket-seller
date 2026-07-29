# TASK-010 — Continuous Integration

## Identificador

TASK-010

## Título

Continuous Integration

## Objetivo

Configurar um pipeline de integração contínua confiável para o monorepo, que valide automaticamente todo pull request e toda alteração na branch principal.

## Status

IN_PROGRESS

## Dependências

TASK-007, TASK-008, TASK-009

## Propriedade exclusiva

- `.github/workflows/ci.yml`

## Arquivos proibidos

- `apps/**`
- `packages/**`
- `prisma/**`
- `compose.yaml`

## Resultado observável

Todo PR e push na branch principal executam automaticamente:

- format:check
- lint
- typecheck
- testes unitários
- testes de integração (Testcontainers)
- build
- validação arquitetural
- integridade de migrations
- scan de secrets
- validação do schema Prisma

## Critérios de aceite

- [ ] `.github/workflows/ci.yml` criado com sintaxe YAML válida
- [ ] Execução em pull_request para main
- [ ] Execução em push para main
- [ ] Concorrência com cancel-in-progress
- [ ] Node 22.18.0 e pnpm 11.17.0 das fontes oficiais
- [ ] pnpm install --frozen-lockfile
- [ ] Cache de pnpm configurado
- [ ] Job quality: format:check + lint + typecheck
- [ ] Job test: testes unitários + testes de integração
- [ ] Job build: build completo
- [ ] Job validate: fundação + arquitetura + migrations + secrets + schema Prisma
- [ ] permissions: contents: read
- [ ] Nenhum continue-on-error em etapas obrigatórias
- [ ] Nenhum secret real
- [ ] Nenhum deploy

## Arquivos criados

- `.github/workflows/ci.yml`
- `.ai/tasks/TASK-010-continuous-integration.md`
- `.ai/reports/TASK-010-continuous-integration.md`

## Documentação atualizada

- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_MAP.md`

## Formato de conclusão

Relatório em `.ai/reports/TASK-010-continuous-integration.md`
