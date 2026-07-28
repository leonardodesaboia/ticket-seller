Propriedade temporária de arquivos

Última atualização: 2026-07-28

Caminho	Responsável	Tarefa	Estado
apps/api/**	Não atribuído	—	AVAILABLE
apps/marketplace-web/**	Não atribuído	—	AVAILABLE
apps/backoffice-web/**	Não atribuído	—	AVAILABLE
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

Regras
somente o responsável pode alterar o caminho;
caminhos filhos herdam a propriedade do caminho pai;
a propriedade termina após o merge;
alterações emergenciais exigem registro;
conflitos são resolvidos pelo integrador.
