TASK-[NÚMERO] — [TÍTULO]
Status

BLOCKED

Responsável

Não atribuído.

Objetivo

Descreva o resultado concreto da tarefa.

Resultado observável

Descreva como confirmar que a tarefa foi concluída.

Coordenação
Branch

feature/TASK-[NÚMERO]-[descrição]

Worktree

../project-task-[NÚMERO]

Dependências obrigatórias
[TASK]
Pode executar em paralelo com
[TASK]
Não pode executar em paralelo com
[TASK ou tipo de alteração]
Propriedade exclusiva
[caminho/**]
Arquivos compartilhados bloqueados
package.json
pnpm-lock.yaml
turbo.json
pnpm-workspace.yaml
Contratos consumidos
[contrato ou “Nenhum”]
Contratos produzidos
[contrato ou “Nenhum”]
Responsável pelo contrato
[agente ou função]
Contexto obrigatório

Leia somente:

AGENTS.md
.ai/coordination/PARALLEL_WORK.md
esta tarefa;
[documento];
[arquivo].
Arquivos permitidos
[caminho]
Arquivos proibidos
arquivos de outras tarefas;
arquivos globais;
migrations;
contratos congelados;
documentação não relacionada.
Requisitos
[requisito]
[requisito]
Invariantes
[invariante]
Segurança
[regra]
Multi-tenancy
[regra ou justificativa de não aplicação]
Concorrência
[regra ou justificativa de não aplicação]
Idempotência
[regra ou justificativa de não aplicação]
Dependências solicitadas

Nenhuma.

Caso necessário, registrar:

Pacote	Aplicação	Tipo	Motivo

	
	
	


O implementador não deve instalar diretamente.

Fora do escopo
[item]
Critérios de aceite

propriedade respeitada;

nenhum arquivo global alterado;

nenhum contrato congelado alterado;

comportamento implementado;

lint aprovado;

typecheck aprovado;

testes aprovados;

build aprovado, quando aplicável;

scan de secrets aprovado;

relatório criado;

commit realizado;

nenhuma tentativa de merge.

Comandos
git diff --check
git diff --stat
git diff --name-status

.ai/scripts/validate-architecture.sh
.ai/scripts/scan-secrets.sh
.ai/scripts/test-affected.sh
Formato de conclusão
Arquivos alterados
Implementado
Testes executados
Dependências solicitadas
Riscos
Pendências
Contratos afetados
Commit