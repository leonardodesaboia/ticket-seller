Dependências entre tarefas
TASK-002 Monorepo (MERGED)
    ↓
TASK-003 Shared Tooling (MERGED)
    ├── TASK-004 API Bootstrap (MERGED)
    ├── TASK-005 Local Infrastructure (MERGED)
    ├── TASK-006 Marketplace Bootstrap (MERGED)
    └── TASK-007 Application Structure Standards (MERGED)
            ├── TASK-008 Database Foundation (MERGED)
            │       └── TASK-010 Continuous Integration (MERGED)
            │               └── TASK-011 Actor Foundation (MERGED)
            │                       └── TASK-012 CreateOrganization (MERGED)
            │                               └── TASK-013 CreateEvent + GetEvent (MERGED)
            │                                       ├── TASK-015 ListOrganizationEvents (MERGED)
            │                                       │       └── TASK-016 UpdateEvent (MERGED)
            │                                       │               └── TASK-018 Event Schedule/Venue Foundation (MERGED)
            │                                       │                       └── TASK-019 Ticket Types Foundation (MERGED)
            │                                       └── TASK-014 Backoffice UI (MERGED)
            └── TASK-009 Backoffice Web Bootstrap (MERGED)
                    └── TASK-017 Event Management Backoffice (MERGED)
                            └── TASK-020 Event Configuration Backoffice (MERGED)

Tabela
Tarefa	Depende de	Pode executar em paralelo com	Bloqueia
TASK-002	—	—	TASK-003
TASK-003	TASK-002	—	TASK-004, TASK-005, TASK-006, TASK-007
TASK-004	TASK-003	TASK-005, TASK-006, TASK-007	TASK-008, TASK-011
TASK-005	TASK-003	TASK-004, TASK-006, TASK-007	TASK-008
TASK-006	TASK-003	TASK-004, TASK-005, TASK-007	—
TASK-007	TASK-004, TASK-006	—	TASK-008, TASK-009
TASK-008	TASK-007	TASK-009	TASK-010, TASK-011
TASK-009	TASK-007	TASK-008	TASK-017
TASK-010	TASK-007, TASK-008, TASK-009	—	TASK-011
TASK-011	TASK-010	—	TASK-012
TASK-012	TASK-011	—	TASK-013, TASK-014
TASK-013	TASK-011, TASK-012	—	TASK-014, TASK-015, TASK-016
TASK-014	TASK-012, TASK-013	TASK-015, TASK-016	—
TASK-015	TASK-013	TASK-016	TASK-017, TASK-018
TASK-016	TASK-015	—	TASK-017, TASK-018
TASK-017	TASK-015, TASK-016	—	TASK-020
TASK-018	TASK-016, TASK-017	—	TASK-019, TASK-020
TASK-019	TASK-018	—	TASK-020
TASK-020	TASK-017, TASK-018, TASK-019	—	—
TASK-020A	TASK-018, TASK-019, TASK-020	—	TASK-021
TASK-021	TASK-020A	—	TASK-022
TASK-022	TASK-021	—	TASK-023
TASK-023	TASK-022	—	TASK-024
TASK-024	TASK-021, TASK-022, TASK-023	Backoffice e marketplace entre si	—
TASK-026	TASK-025	TASK-024 (frontend-only)	TASK-028
TASK-027	TASK-026	—	TASK-028
TASK-065	TASK-029, TASK-060	—	—
TASK-066	TASK-064, TASK-065	—	Arquitetura, workers e contracts futuros

Regras
dependências precisam estar em MERGED;
não considerar apenas branch concluída;
contrato compartilhado deve estar integrado;
mudanças globais bloqueiam tarefas dependentes;
tarefas sem independência clara devem ser sequenciais.
