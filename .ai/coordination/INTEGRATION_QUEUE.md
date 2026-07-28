Fila de integração

Última atualização: 2026-07-28

Ordem	Tarefa	Branch	Review	Rebase	CI	Status
1	TASK-005	feature/TASK-005-local-infrastructure	PENDING	PENDING	PENDING	WAITING
2	TASK-004	feature/TASK-004-api-bootstrap	PENDING	PENDING	PENDING	WAITING
3	TASK-006	feature/TASK-006-marketplace-web-bootstrap	PENDING	PENDING	PENDING	WAITING

Notas
TASK-005 integrada primeiro: sem conflito de pnpm-lock.yaml (Docker Compose, sem pnpm install)
TASK-004 integrada em segundo: pnpm install resolve lock na raiz após merge
TASK-006 integrada por último: idem

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
executar pnpm install na raiz para regenerar pnpm-lock.yaml canonical;
atualizar os arquivos de coordenação;
remover worktree;
remover branch local quando seguro.
