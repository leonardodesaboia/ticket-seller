TASK-[NÚMERO] — [TÍTULO]
Status

PLANNED

Valores:

PLANNED
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
Objetivo

Descreva o resultado concreto desta tarefa em uma ou duas frases.

Resultado observável

Descreva o comportamento que deverá existir depois da implementação.

Contexto obrigatório

O agente deve ler somente:

AGENTS.md
.ai/tasks/TASK-[NÚMERO]-[nome].md
[documento relevante]
[README do módulo]
[arquivos de código necessários]
[testes necessários]
Arquivos permitidos

O agente pode criar ou alterar somente:

[caminho]
[caminho]
Arquivos proibidos

O agente não pode alterar:

arquivos fora da lista permitida;
migrations aplicadas;
módulos não relacionados;
arquivos gerados;
lockfile sem instalação aprovada;
documentação não relacionada.
Requisitos funcionais
[requisito]
[requisito]
[requisito]
Requisitos técnicos
[requisito]
[requisito]
[requisito]
Invariantes
[regra que nunca pode ser violada]
[regra que nunca pode ser violada]
Segurança
[regra]
[validação]
[dado que não pode aparecer em logs]
Multi-tenancy
[como organizationId deve ser aplicado]
[comportamento esperado em acesso cruzado]

Quando não aplicável, justificar.

Concorrência
[operações que podem ocorrer simultaneamente]
[resultado esperado]

Quando não aplicável, justificar.

Idempotência
[operação repetível]
[chave utilizada]
[resultado da repetição]

Quando não aplicável, justificar.

Fora do escopo
[funcionalidade excluída]
[integração excluída]
[refatoração excluída]
Plano esperado

Antes de implementar, apresentar:

solução;
arquivos;
fluxo;
riscos;
testes.
Critérios de aceite

comportamento principal implementado;

nenhum arquivo fora do escopo alterado;

lint aprovado;

typecheck aprovado;

testes unitários aprovados;

testes de integração aprovados, quando aplicável;

testes de concorrência aprovados, quando aplicável;

documentação relacionada atualizada;

nenhuma dependência adicionada sem justificativa.

Comandos
pnpm lint
pnpm typecheck
pnpm test

Adicionar comandos específicos quando existirem.

Conclusão esperada
Arquivos alterados
[arquivo]: [mudança]
Implementado
[comportamento]
Testes
[comando]: aprovado/reprovado
Decisões
[decisão]
Pendências
[pendência ou “Nenhuma”]
Próxima tarefa
[tarefa]