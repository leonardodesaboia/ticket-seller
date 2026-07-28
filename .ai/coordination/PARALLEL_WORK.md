Política de desenvolvimento paralelo com IA
1. Objetivo

Permitir que múltiplos agentes de IA trabalhem simultaneamente sem:

sobrescrever alterações;
editar os mesmos arquivos;
criar conflitos desnecessários;
quebrar contratos compartilhados;
alterar migrations em paralelo;
gerar inconsistências arquiteturais;
duplicar funcionalidades;
realizar merges sem validação.

O paralelismo deve reduzir o tempo de desenvolvimento sem comprometer segurança, rastreabilidade e qualidade.

2. Princípio central

Cada tarefa paralela deve possuir branch, worktree, escopo e propriedade de arquivos exclusivos.

Duas tarefas simultâneas não podem alterar o mesmo caminho.

Quando dois trabalhos dependem do mesmo arquivo, eles devem ser executados sequencialmente ou coordenados por um único responsável.

3. Papéis
Orquestrador

Responsável por:

dividir features em tarefas;
identificar dependências;
definir quais tarefas podem executar em paralelo;
atribuir propriedade de arquivos;
bloquear arquivos compartilhados;
ordenar a fila de integração;
atualizar os arquivos de coordenação.

O orquestrador não precisa implementar código.

Implementador

Responsável por:

trabalhar em um único worktree;
executar uma única tarefa;
alterar somente arquivos permitidos;
criar testes;
executar validações;
gerar relatório;
realizar commit na própria branch.

O implementador não realiza merge.

Revisor

Responsável por:

analisar a tarefa e o diff;
verificar escopo;
verificar arquitetura;
verificar segurança;
verificar multi-tenancy;
verificar concorrência;
verificar idempotência;
verificar testes;
apontar conflitos com trabalhos paralelos.

O revisor não altera arquivos durante o modo REVIEW.

Integrador

Responsável por:

revisar a fila de integração;
atualizar branches;
executar rebase;
resolver conflitos;
instalar dependências aprovadas;
integrar alterações compartilhadas;
executar validação completa;
realizar merge;
atualizar a branch principal.

Somente o integrador pode alterar arquivos globais bloqueados durante ciclos paralelos.

4. Pré-requisitos para iniciar paralelismo

O trabalho paralelo só pode começar quando:

o monorepo estiver configurado;
o workspace estiver funcionando;
TypeScript compartilhado estiver configurado;
ESLint compartilhado estiver configurado;
Prettier estiver configurado;
os comandos básicos de validação estiverem funcionando;
as tarefas possuírem escopo definido;
a propriedade dos arquivos estiver registrada;
as dependências entre tarefas estiverem registradas.

Não iniciar vários agentes durante mudanças na fundação global.

5. Isolamento com Git worktrees

Cada tarefa deve possuir:

uma branch;
um worktree;
um agente responsável.

Padrão de branch:

feature/TASK-000-description
fix/BUG-000-description
chore/TASK-000-description
docs/TASK-000-description

Padrão de worktree:

../project-task-000

Exemplo:

git worktree add \
  ../tickets-task-004-api \
  -b feature/TASK-004-api-bootstrap

git worktree add \
  ../tickets-task-005-infra \
  -b feature/TASK-005-local-infrastructure

Cada agente deve abrir somente o worktree atribuído.

É proibido executar duas IAs no mesmo diretório de trabalho.

6. Propriedade exclusiva

Cada tarefa deve declarar caminhos de propriedade exclusiva.

Exemplo:

TASK-004:
- apps/api/**

TASK-005:
- infra/**
- compose.yaml
- .env.example

TASK-006:
- apps/marketplace-web/**

TASK-007:
- apps/backoffice-web/**

Uma tarefa não pode alterar um caminho pertencente a outra tarefa ativa.

Caso seja necessária alteração fora da propriedade:

interromper a implementação;
registrar a necessidade;
informar o caminho;
explicar o motivo;
solicitar alteração ao integrador;
aguardar a atualização da base.
7. Arquivos globais bloqueados

Durante trabalho paralelo, os seguintes arquivos devem possuir um único responsável:

package.json
pnpm-lock.yaml
pnpm-workspace.yaml
turbo.json
AGENTS.md
README.md
compose.yaml
schema.prisma
prisma/migrations/**
packages/eslint-config/**
packages/typescript-config/**
packages/prettier-config/**
packages/contracts/**
packages/api-client/**
openapi.json
.github/workflows/**

Esses arquivos não podem ser alterados livremente por implementadores.

O orquestrador pode atribuir temporariamente um deles a uma tarefa específica.

8. Dependências

Toda tarefa deve declarar:

tarefas necessárias antes de iniciar;
tarefas que podem executar em paralelo;
tarefas incompatíveis;
contratos consumidos;
contratos produzidos.

Estados possíveis:

BLOCKED
READY
IN_PROGRESS
IN_REVIEW
READY_TO_MERGE
MERGED
CANCELLED

Uma tarefa só pode iniciar quando todas as dependências obrigatórias estiverem em MERGED.

9. Contratos compartilhados

Frontend, backend e testes podem executar em paralelo quando existe um contrato aprovado.

Contratos possíveis:

OpenAPI;
schema de request e response;
eventos versionados;
interfaces de ports;
exemplos JSON;
schemas Zod;
contratos de mensagens.

Após o início das tarefas dependentes, o contrato entra em estado FROZEN.

Um contrato congelado não pode ser alterado por um implementador.

Mudanças exigem:

interromper tarefas dependentes;
atualizar a tarefa de contrato;
aprovar a alteração;
integrar o novo contrato;
realizar rebase das tarefas dependentes.
10. Banco de dados e migrations

Somente uma tarefa por vez pode alterar:

schema do banco;
migrations;
seeds;
constraints;
índices;
modelos Prisma;
tipos gerados pelo banco.

Deve existir um responsável temporário denominado Database Owner.

Fluxo:

Tarefa identifica necessidade de banco
→ registra solicitação
→ Database Owner cria migration
→ migration é revisada
→ migration é integrada
→ tarefas dependentes fazem rebase
→ implementação continua

É proibido criar migrations simultâneas em branches paralelas.

Migrations aplicadas nunca podem ser modificadas.

11. Dependências de pacotes

Somente o integrador ou o responsável pelo tooling pode alterar:

package.json;
pnpm-lock.yaml;
configurações globais de workspace.

Quando um agente precisar de uma dependência, deve registrar:

Pacote:
Aplicação:
Tipo:
Motivo:
Alternativas consideradas:
Impacto:

O integrador decide, instala e integra a dependência.

Depois disso, as branches afetadas devem fazer rebase.

12. Limites de cada agente

Um implementador paralelo não deve:

editar arquivos globais bloqueados;
instalar dependências;
executar merge;
executar cherry-pick;
reescrever histórico;
modificar outra branch;
alterar contratos congelados;
criar migrations;
realizar busca e substituição global;
formatar arquivos fora do escopo;
corrigir erros de tarefas paralelas;
aumentar o próprio escopo;
alterar documentação não relacionada.
13. Validação da tarefa

Antes de entregar uma branch, o implementador deve:

confirmar os arquivos alterados;
executar lint relacionado;
executar typecheck relacionado;
executar testes relacionados;
executar build da aplicação, quando aplicável;
revisar o diff;
executar scan de secrets;
criar relatório;
realizar commit;
alterar o status para IN_REVIEW.

Comandos recomendados:

git diff --check
git diff --stat
git diff --name-status

.ai/scripts/validate-architecture.sh
.ai/scripts/validate-migrations.sh
.ai/scripts/scan-secrets.sh
.ai/scripts/test-affected.sh
14. Review independente

O revisor deve receber:

AGENTS.md;
tarefa;
documentação do módulo;
contrato relacionado;
diff contra a branch base;
testes alterados;
propriedade da tarefa.

O revisor deve verificar também:

arquivos fora da propriedade;
contrato alterado indevidamente;
conflito potencial com tarefa paralela;
dependência nova não aprovada;
mudança em arquivo global;
duplicação de implementação.

Problemas devem ser classificados como:

BLOQUEANTE
ALTO
MÉDIO
BAIXO

Problemas bloqueantes e altos impedem integração.

15. Fila de integração

Branches aprovadas entram em .ai/coordination/INTEGRATION_QUEUE.md.

A ordem deve considerar:

dependências compartilhadas;
infraestrutura;
backend;
contratos;
frontends;
testes integrados;
documentação.

Não integrar diversas branches sem validar o projeto entre os merges.

Após cada merge relevante:

pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
16. Política de conflitos

Implementadores não devem resolver conflitos entre tarefas paralelas.

O integrador resolve conflitos.

Quando houver conflito:

identificar qual tarefa possui propriedade oficial;
preservar a implementação do proprietário;
adaptar a tarefa dependente;
não combinar automaticamente versões divergentes;
executar novamente os testes;
registrar a decisão no relatório de integração.

Caso o conflito represente mudança arquitetural, criar ou atualizar ADR.

17. Limite de paralelismo

No início do projeto, utilizar no máximo:

um orquestrador;
três implementadores;
um revisor;
um integrador.

O número pode aumentar quando:

a CI estiver estável;
os módulos estiverem bem isolados;
contratos estiverem versionados;
testes estiverem confiáveis;
conflitos forem raros.

Mais agentes não significam necessariamente mais velocidade.

18. Fluxo oficial
1. Orquestrador cria tarefas
2. Orquestrador define dependências
3. Orquestrador atribui propriedade
4. Orquestrador cria worktrees
5. Implementadores executam PLAN
6. Planos são aprovados
7. Implementadores executam IMPLEMENT
8. Implementadores testam
9. Implementadores fazem commit
10. Revisores analisam os diffs
11. Correções aprovadas são aplicadas
12. Branch entra na fila de integração
13. Integrador realiza rebase
14. Integrador executa validações
15. Integrador realiza merge
16. Estado e coordenação são atualizados
17. Worktree é removido
19. Regra de ouro

Paralelizar por módulos e contratos, nunca por arquivos compartilhados.

Uma tarefa deve possuir um resultado independente e integrável.

Quando a independência não estiver clara, executar as tarefas sequencialmente.