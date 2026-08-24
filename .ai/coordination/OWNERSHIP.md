Propriedade temporária de arquivos

Última atualização: 2026-08-24

Caminho	Responsável	Tarefa	Estado
apps/api/**	—	—	AVAILABLE
apps/marketplace-web/**	—	—	AVAILABLE
apps/backoffice-web/**	—	—	AVAILABLE
infra/**	—	—	AVAILABLE
compose.yaml	—	—	AVAILABLE
.env.example	—	—	AVAILABLE

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

Nota: RC-1.0 entregue em 2026-08-24. Nenhuma tarefa ativa — todos os caminhos estão AVAILABLE.

Regras
somente o responsável pode alterar o caminho;
caminhos filhos herdam a propriedade do caminho pai;
a propriedade termina após o merge;
alterações emergenciais exigem registro;
conflitos são resolvidos pelo integrador.
