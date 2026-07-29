Propriedade temporária de arquivos

Última atualização: 2026-07-28

Caminho	Responsável	Tarefa	Estado
apps/api/prisma/**	Database Owner	TASK-022	LOCKED
apps/api/src/modules/events/**	Backend publication owner	TASK-021–TASK-023	OWNED
apps/api/src/modules/venues/**	Não atribuído	—	AVAILABLE
apps/marketplace-web/**	Frontend marketplace owner	TASK-024	FROZEN
apps/backoffice-web/**	Frontend backoffice owner	TASK-024	FROZEN
infra/**	Não atribuído	—	AVAILABLE
compose.yaml	Não atribuído	—	AVAILABLE
.env.example	Não atribuído	—	AVAILABLE

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

Contratos de readiness, publicação e catálogo	Orquestrador	FROZEN

Regras
somente o responsável pode alterar o caminho;
caminhos filhos herdam a propriedade do caminho pai;
a propriedade termina após o merge;
alterações emergenciais exigem registro;
conflitos são resolvidos pelo integrador.
