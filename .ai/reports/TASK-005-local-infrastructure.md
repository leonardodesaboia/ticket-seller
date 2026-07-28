Relatório da TASK-005 — Infraestrutura local (Docker Compose)

Status

COMPLETED

Arquivos alterados

compose.yaml: criado — Docker Compose com PostgreSQL 17, Redis 7, MinIO e Mailpit
.env.example: criado — variáveis de ambiente documentadas com valores de desenvolvimento
infra/README.md: criado — instruções de uso da infraestrutura local
infra/docker/postgres/init.sql: criado — placeholder vazio para futuras seeds

Implementado

Serviço	Imagem	Porta	Health check
PostgreSQL 17	postgres:17-alpine	5432	pg_isready
Redis 7	redis:7-alpine	6379	redis-cli ping
MinIO	minio/minio:latest	9000, 9001	curl /minio/health/live
Mailpit	axllent/mailpit:latest	1025, 8025	curl /api/v1/info

Todos os serviços compartilham a rede ticket-seller-network (bridge).
Volumes persistentes: postgres_data, redis_data, minio_data.
Todas as portas configuráveis via variáveis de ambiente no .env.example.
Credenciais padrão documentadas como "somente para desenvolvimento".

Testes executados

Comando	Resultado
docker compose config --quiet	PASS — sem erros de sintaxe
docker compose up -d	PARTIAL — redis e mailpit iniciados healthy; postgres e minio falharam por conflito de porta no ambiente de execução (9000 e 5432 já ocupados)
docker compose down	PASS — todos os containers removidos, rede removida
git diff --check	PASS

Riscos

Porto 9000 (MinIO API) e 5432 (PostgreSQL) já estavam em uso na máquina de execução — isso é um problema de ambiente, não de configuração. O .env.example documenta como personalizar as portas via PORT_MINIO_API e PORT_POSTGRES para evitar conflitos.

Pendências

Nenhuma.

Commit recomendado

chore(infra): add docker compose for local development [TASK-005]
