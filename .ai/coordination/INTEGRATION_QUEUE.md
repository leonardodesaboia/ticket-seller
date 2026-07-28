Fila de integração

Última atualização: AAAA-MM-DD

Ordem	Tarefa	Branch	Review	Rebase	CI	Status
1	TASK-000	feature/TASK-000-description	PENDING	PENDING	PENDING	WAITING
Estados
WAITING;
REVIEWING;
REBASING;
VALIDATING;
READY;
MERGED;
BLOCKED.
Critérios para entrar na fila
implementação concluída;
commit realizado;
relatório criado;
review aprovado;
problemas bloqueantes corrigidos;
arquivos alterados dentro da propriedade;
testes da tarefa aprovados.
Procedimento de integração
atualizar main;
fazer rebase da branch;
resolver conflitos;
executar validações da tarefa;
executar validação global aplicável;
revisar diff final;
realizar merge;
atualizar os arquivos de coordenação;
remover worktree;
remover branch local quando seguro.