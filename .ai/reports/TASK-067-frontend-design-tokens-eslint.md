Relatório da TASK-067

Status

COMPLETED

Arquivos alterados

- `packages/design-tokens/tokens.css`: tokens semânticos de superfícies de feedback, espaçamento e tipografia.
- `apps/*-web/src/app/globals.css`: mapeamento dos tokens para utilities Tailwind 4.
- `apps/*-web/src/features/**`: substituição de cores primitivas por tokens semânticos.
- `tools/eslint-rules/**`: regras locais e testes para proibir primitivas visuais.
- `eslint.config.mjs` e manifestos dos apps: ativação do guardrail e ESLint CLI.

Implementado

- Tokens `success-muted`, `warning-muted`, `info-muted` e `destructive-muted` para estados visuais.
- Tokens nomeados de espaçamento e tipografia disponíveis nos dois apps.
- Proteção contra cores primitivas, inclusive variantes, modificadores de opacidade arbitrários e propriedades CSS arbitrárias de cor.
- Proteção contra valores Tailwind arbitrários de cor, spacing e tipografia.

Decisões tomadas

- A escala nomeada do Tailwind permanece um token aprovado nesta etapa; somente valores arbitrários são bloqueados para spacing e tipografia.
- Nenhum ADR novo foi criado: a implementação concretiza a ADR-004, que já determina tokens centralizados e consumo semântico.

Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm test:design-tokens` | aprovado |
| `pnpm --filter @ticket-seller/marketplace-web lint` | aprovado |
| `pnpm --filter @ticket-seller/backoffice-web lint` | aprovado |
| `pnpm --filter @ticket-seller/marketplace-web typecheck` | aprovado |
| `pnpm --filter @ticket-seller/backoffice-web typecheck` | aprovado |
| testes Jest do marketplace | 72 aprovados |
| testes Jest do backoffice | 96 aprovados |
| build do marketplace | aprovado |
| build do backoffice | reprovado: `ENOENT` em `.next/server/pages-manifest.json` após compilação |

Riscos identificados

- O build do backoffice possui falha de artefato `.next` a ser investigada em diretório limpo.
- A migração dos usos existentes da escala nomeada de spacing e tipografia para papéis estritamente semânticos permanece incremental.

Pendências

- Investigar a falha de build do backoffice sem incluir artefatos `.next` no controle de versão.

Documentação atualizada

- `.ai/tasks/TASK-067-frontend-design-tokens-eslint.md`
- `.ai/reports/TASK-067-frontend-design-tokens-eslint.md`
- `packages/design-tokens/README.md`
- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_MAP.md`

Próxima tarefa recomendada

Migrar incrementalmente spacing e tipografia para nomes semânticos, começando pelos componentes compartilhados.
