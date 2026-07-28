Propriedade temporária de arquivos

Última atualização: 2026-07-28

Caminho	Responsável	Tarefa	Estado
apps/api/**	Implementador-1	TASK-004	LOCKED
apps/marketplace-web/**	Implementador-3	TASK-006	LOCKED
apps/backoffice-web/**	Não atribuído	—	AVAILABLE
infra/**	Implementador-2	TASK-005	LOCKED
compose.yaml	Implementador-2	TASK-005	LOCKED
.env.example (raiz)	Implementador-2	TASK-005	LOCKED

Estados
AVAILABLE;
LOCKED;
OWNED;
FROZEN.

Arquivos globais
Caminho	Responsável
package.json	Integrador
pnpm-lock.yaml	Integrador
pnpm-workspace.yaml	Integrador
turbo.json	Integrador
AGENTS.md	Orquestrador
schema.prisma	Database Owner
prisma/migrations/**	Database Owner
packages/contracts/**	Contract Owner
openapi.json	Contract Owner

Regras
somente o responsável pode alterar o caminho;
caminhos filhos herdam a propriedade do caminho pai;
a propriedade termina após o merge;
alterações emergenciais exigem registro;
conflitos são resolvidos pelo integrador.
