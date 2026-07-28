Dependências entre tarefas
TASK-002 Monorepo (MERGED)
    ↓
TASK-003 Shared Tooling (MERGED)
    ├── TASK-004 API Bootstrap (READY)
    ├── TASK-005 Local Infrastructure (READY)
    ├── TASK-006 Marketplace Bootstrap (READY)
    └── TASK-007 Backoffice Bootstrap (BLOCKED)

Tabela
Tarefa	Depende de	Pode executar em paralelo com	Bloqueia
TASK-002	—	—	TASK-003
TASK-003	TASK-002	—	TASK-004, TASK-005, TASK-006, TASK-007
TASK-004	TASK-003	TASK-005, TASK-006, TASK-007	Database Foundation
TASK-005	TASK-003	TASK-004, TASK-006, TASK-007	Database Foundation
TASK-006	TASK-003	TASK-004, TASK-005, TASK-007	Frontend Features
TASK-007	TASK-003	TASK-004, TASK-005, TASK-006	Backoffice Features

Regras
dependências precisam estar em MERGED;
não considerar apenas branch concluída;
contrato compartilhado deve estar integrado;
mudanças globais bloqueiam tarefas dependentes;
tarefas sem independência clara devem ser sequenciais.
