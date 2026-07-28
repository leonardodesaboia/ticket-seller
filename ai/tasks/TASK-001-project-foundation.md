TASK-001 — Fundação do repositório
Status

IN_PROGRESS

Objetivo

Criar a fundação documental e operacional para desenvolvimento assistido por IA.

Resultado observável

O repositório deve possuir regras oficiais, documentação inicial, templates e workflows que permitam executar tarefas com contexto limitado.

Contexto obrigatório
AGENTS.md
docs/INDEX.md
docs/PROJECT.md
docs/DOMAIN.md
docs/ARCHITECTURE.md
docs/REPOSITORY_MAP.md
docs/CURRENT_STATE.md
Arquivos permitidos
AGENTS.md
docs/**
.ai/**
.gitignore
README.md
Arquivos proibidos
apps/**
packages/**
infra/**
arquivos de dependências;
arquivos de framework;
qualquer implementação de domínio.
Requisitos
Criar regras globais para agentes.
Criar documentação oficial inicial.
Criar template de tarefa.
Criar template de ADR.
Criar template de relatório.
Criar workflows PLAN, IMPLEMENT, REVIEW e FIX.
Criar mapa do repositório.
Criar estado atual.
Invariantes
Conversas não são fonte oficial.
Cada assunto possui uma fonte oficial.
O agente não pode alterar arquivos fora do escopo.
A fundação não pode instalar frameworks.
Segurança
Nenhum secret deve ser incluído.
Nenhuma credencial real deve ser utilizada.
Nenhum acesso externo deve ser configurado.
Multi-tenancy

Não aplicável à implementação desta tarefa, mas as regras globais devem contemplá-lo.

Concorrência

Não aplicável.

Idempotência

Não aplicável.

Fora do escopo
monorepo;
NestJS;
Next.js;
PostgreSQL;
Redis;
Docker Compose;
domínio;
pagamentos.
Critérios de aceite

AGENTS.md criado;

documentação oficial criada;

templates criados;

workflows criados;

nenhuma dependência instalada;

nenhum arquivo de aplicação criado;

primeiro commit realizado.

Validação
git status
git diff --check
find docs .ai -type f | sort
Commit recomendado
chore: establish AI development foundation