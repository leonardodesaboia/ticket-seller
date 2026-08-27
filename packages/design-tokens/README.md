# Design tokens

`tokens.css` é a única fonte de verdade para os tokens compartilhados dos frontends.

## Camadas

- Primitivos: valores brutos internos, usados apenas para compor o tema.
- Semânticos: cores de superfície, ação, feedback e controle consumidas pelos componentes.
- Layout e tipografia: papéis nomeados, expostos ao Tailwind 4 como `p-page-gutter`, `gap-content`, `text-body` e `font-sans`.

As aplicações devem importar `@ticket-seller/design-tokens/tokens.css` no `globals.css` e mapear somente esses tokens em `@theme inline`. Não devem criar paletas locais.

## Guardrail

O ESLint local em `tools/eslint-rules/` bloqueia cores primitivas do Tailwind e valores arbitrários para cor, espaçamento e tipografia nos diretórios `src/` dos dois frontends. A escala nomeada padrão do Tailwind permanece válida como token de escala nesta fase.
