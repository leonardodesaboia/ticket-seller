TASK-005 — Local Infrastructure

Status

READY

Responsável

Não atribuído.

Objetivo

Criar a infraestrutura local de desenvolvimento com Docker Compose. Serviços: PostgreSQL, Redis, MinIO e Mailpit. Sem schema, migrations, filas externas ou infraestrutura de produção.

Resultado observável

docker compose up -d executa sem erro
docker compose ps mostra todos os serviços healthy
PostgreSQL acessível na porta 5432
Redis acessível na porta 6379
MinIO acessível na porta 9000 (API) e 9001 (console)
Mailpit acessível na porta 8025 (UI) e 1025 (SMTP)
.env.example documenta todas as variáveis necessárias
docker compose down para os serviços sem erro

Coordenação

Branch

feature/TASK-005-local-infrastructure

Worktree

../ticket-seller-task-005

Dependências obrigatórias

TASK-003 (MERGED)

Pode executar em paralelo com

TASK-004
TASK-006

Não pode executar em paralelo com

Nenhuma outra tarefa em infra/** ou compose.yaml

Propriedade exclusiva

infra/**
compose.yaml
.env.example

Arquivos compartilhados bloqueados

Não alterar:
package.json (raiz)
pnpm-lock.yaml
turbo.json
pnpm-workspace.yaml
AGENTS.md
CLAUDE.md
apps/**
packages/**
docs/**
.ai/**

Contratos consumidos

Nenhum.

Contratos produzidos

PostgreSQL: host=localhost, port=5432, user=postgres, password=postgres, db=ticket_seller
Redis: host=localhost, port=6379
MinIO: endpoint=http://localhost:9000, access_key=minioadmin, secret_key=minioadmin
Mailpit SMTP: host=localhost, port=1025
Mailpit UI: http://localhost:8025

Contexto obrigatório

Leia somente:

AGENTS.md
esta tarefa

Arquivos permitidos

infra/**
compose.yaml
.env.example

Arquivos proibidos

Qualquer arquivo fora de infra/, compose.yaml e .env.example
apps/**
packages/**
package.json (raiz)
pnpm-lock.yaml
turbo.json
docs/**
.ai/**

Requisitos

1. Criar compose.yaml na raiz com os quatro serviços
2. Configurar PostgreSQL 17 com volume persistente e health check
3. Configurar Redis 7 com volume persistente e health check
4. Configurar MinIO com volume persistente, health check e criação automática do bucket padrão
5. Configurar Mailpit com health check
6. Definir rede local compartilhada entre os serviços (ticket-seller-network)
7. Criar .env.example na raiz com todas as variáveis documentadas
8. Criar infra/docker/postgres/init.sql vazio (placeholder para futuras seeds)
9. Criar infra/README.md com instruções de uso

Imagens Docker

PostgreSQL: postgres:17-alpine
Redis: redis:7-alpine
MinIO: minio/minio:latest
Mailpit: axllent/mailpit:latest

Configuração dos serviços

PostgreSQL:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_DB: ticket_seller
  porta: 5432
  health check: pg_isready -U postgres

Redis:
  porta: 6379
  health check: redis-cli ping

MinIO:
  MINIO_ROOT_USER: minioadmin
  MINIO_ROOT_PASSWORD: minioadmin
  porta API: 9000
  porta console: 9001
  comando: server /data --console-address :9001
  health check: curl -f http://localhost:9000/minio/health/live

Mailpit:
  porta SMTP: 1025
  porta UI: 8025
  health check: curl -f http://localhost:8025/api/v1/info

Variáveis de ambiente (.env.example)

Documentar todas as variáveis dos quatro serviços com comentários explicativos.
Incluir PORT_POSTGRES, PORT_REDIS, PORT_MINIO_API, PORT_MINIO_CONSOLE, PORT_MAILPIT_UI, PORT_MAILPIT_SMTP.
Incluir comentário sobre como customizar portas para evitar conflito com serviços locais.

Estrutura esperada

compose.yaml              (raiz)
.env.example              (raiz)
infra/
├── README.md
└── docker/
    └── postgres/
        └── init.sql      (vazio — placeholder)

Invariantes

Nenhuma migration ou schema pode ser criado nesta tarefa.
Credenciais nos arquivos são apenas para desenvolvimento local.
Não criar configuração de produção.
Não criar filas externas (RabbitMQ, SQS, etc.).

Segurança

Credenciais de dev no compose.yaml são aceitáveis.
.env.example não deve conter secrets reais — apenas placeholders e valores de dev.
Documentar no .env.example que as credenciais padrão são apenas para desenvolvimento.

Multi-tenancy

Não aplicável nesta tarefa.

Concorrência

Não aplicável nesta tarefa.

Idempotência

Não aplicável nesta tarefa.

Fora do escopo

Schema de banco de dados
Migrations
Filas (RabbitMQ, SQS, BullMQ)
Infraestrutura de produção (Terraform, Kubernetes)
Configuração de CI/CD
Seeds de dados
SSL local
Configuração de backup
Serviços de terceiros (Stripe, Asaas, etc.)

Critérios de aceite

propriedade respeitada (apenas infra/**, compose.yaml, .env.example);
nenhum arquivo global alterado;
docker compose config --quiet passa sem erro de sintaxe;
docker compose up -d inicia todos os serviços;
docker compose ps mostra todos healthy (pode levar alguns segundos);
docker compose down para sem erro;
.env.example documenta todas as variáveis;
relatório criado em .ai/reports/TASK-005-local-infrastructure.md;
commit realizado na branch feature/TASK-005-local-infrastructure.

Comandos de validação

docker compose config --quiet
docker compose up -d
docker compose ps
docker compose down
git diff --check
git diff --stat
git diff --name-status

Formato de conclusão

Arquivos alterados
Implementado
Testes executados
Riscos
Pendências
Commit

Commit recomendado

chore(infra): add docker compose for local development [TASK-005]
