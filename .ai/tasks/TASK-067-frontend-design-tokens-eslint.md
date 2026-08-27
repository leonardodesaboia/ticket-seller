TASK-067 — Guardrails de design tokens no frontend

Status

COMPLETED

Objetivo

Centralizar os tokens semânticos ausentes de feedback, espaçamento e tipografia e impedir a reintrodução de cores primitivas ou valores visuais arbitrários nos frontends.

Resultado observável

Os dois aplicativos web usam o mesmo contrato de tokens. O ESLint rejeita cores primitivas do Tailwind, propriedades CSS de cor arbitrárias e valores arbitrários para cor, espaçamento ou tipografia.

Contexto obrigatório

AGENTS.md
docs/ARCHITECTURE.md
docs/decisions/ADR-004-application-folder-architecture.md
packages/design-tokens/tokens.css
eslint.config.mjs

Arquivos permitidos

packages/design-tokens/**
apps/marketplace-web/**
apps/backoffice-web/**
tools/eslint-rules/**
eslint.config.mjs
package.json
.ai/tasks/TASK-067-frontend-design-tokens-eslint.md
.ai/reports/TASK-067-frontend-design-tokens-eslint.md
docs/CURRENT_STATE.md
docs/REPOSITORY_MAP.md

Arquivos proibidos

apps/api/**
infra/**
migrations aplicadas
contratos da API

Requisitos funcionais

- Estados visuais de sucesso, aviso, informação, destrutivo e overlay usam tokens semânticos.
- Espaçamento e tipografia possuem tokens nomeados disponíveis para Tailwind 4.
- Componentes não usam cores primitivas do Tailwind.

Requisitos técnicos

- Substituir o comando legado `next lint` por ESLint CLI.
- Criar regras ESLint locais com testes unitários.
- Rejeitar variantes e modificadores de opacidade que escondam cores primitivas.
- Manter a escala nomeada padrão do Tailwind como token aprovado; valores arbitrários são proibidos.

Invariantes

- A paleta continua centralizada em `packages/design-tokens/tokens.css`.
- Nenhuma regra de negócio, autorização, pagamento, estoque ou contrato HTTP é alterado.
- Os frontends continuam consumindo apenas tokens semânticos para cores.

Segurança

Não aplicável: a tarefa não adiciona entrada externa, autenticação, logs ou dados sensíveis.

Multi-tenancy

Não aplicável: não há alteração de consultas, rotas ou autorização.

Concorrência

Não aplicável: não há alteração de operações assíncronas ou de dados.

Idempotência

Não aplicável: não há alteração de comandos remotos.

Fora do escopo

- Rebranding ou criação de novas superfícies.
- Migração integral das classes nomeadas existentes de spacing e tipografia para nomes semânticos.
- Alterações em API, OpenAPI, pagamentos ou autenticação.

Critérios de aceite

- Lint dos dois frontends aprovado.
- Typecheck e testes existentes dos dois frontends aprovados.
- Regra local possui casos válidos e inválidos.
- Documentação de tarefa, relatório e estado do projeto atualizados.
