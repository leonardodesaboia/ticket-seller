ADR-009 — Dockerfiles portáveis sem acoplamento a cloud provider específica

Status

ACCEPTED

Data

2026-08-18

Contexto

O produto precisa de containerização para deployment em produção. Em sessão de planejamento (2026-08-18), o cloud target de produção não foi definido — a decisão ficou aberta para depois do MVP. As opções disponíveis incluem Railway, Fly.io, AWS ECS, GCP Cloud Run, e VPS autogerenciado com Docker Compose.

Duas estratégias foram avaliadas:

**A — Dockerfiles portáveis**: imagens Docker padrão, sem configuração de cloud. O mesmo Dockerfile funciona em Railway, Fly.io, ECS, ou `docker-compose` em VPS.

**B — Cloud-specific desde o início**: configurar diretamente para um provider (ex: `fly.toml` para Fly.io, `Dockerfile` + ECS task definition para AWS). Acoplamento imediato ao provider escolhido.

Decisão

**Opção A — Dockerfiles portáveis, multi-stage, sem configuração de cloud específica.**

Detalhes técnicos:

**`apps/api/Dockerfile`** — multi-stage:
- Stage `builder`: instala dependências completas, compila TypeScript, executa `prisma generate`.
- Stage `runner`: copia apenas `dist/`, `node_modules/` de produção, `prisma/` (schema + migrations). Usuário não-root `appuser`. Expõe porta 3000. HEALTHCHECK via `GET /health/live`.

**`apps/marketplace-web/Dockerfile`** e **`apps/backoffice-web/Dockerfile`**:
- Aproveitam `output: 'standalone'` do Next.js — produz bundle autossuficiente em `.next/standalone`.
- Stage `runner` copia apenas o standalone output e arquivos estáticos. Usuário não-root.

**Migration init container**:
- Em `docker-compose.prod.yml`: serviço `api-migrate` executa `npx prisma migrate deploy` antes da API subir.
- `depends_on: api-migrate: condition: service_completed_successfully` garante que API não sobe se migration falhar.
- Idempotente: `prisma migrate deploy` é seguro para rodar múltiplas vezes (advisory lock no Postgres previne concorrência).

**`.dockerignore`** por app:
- Exclui `node_modules/`, `.next/`, `*.tsbuildinfo`, arquivos de teste, `.env*`.
- Evita copiar arquivos desnecessários para o builder (build mais rápido).

**Portabilidade**:
- Qualquer runtime que execute Docker consegue rodar a imagem: Railway, Fly.io, ECS, GCP Cloud Run, VPS com Docker.
- Configuração de cloud (fly.toml, apprunner.yaml, etc.) pode ser adicionada depois sem alterar os Dockerfiles.

Razões

nenhum engineer precisa conhecer um provider específico para fazer deploy;
a imagem pode ser testada localmente com `docker run` antes de qualquer deploy;
mudança de provider no futuro requer apenas adicionar arquivo de configuração do provider — sem reescrever Dockerfile;
segurança: usuário não-root por padrão, sem variáveis sensíveis hardcoded na imagem;
migration init container resolve o problema de "quem aplica migrations" sem assumir que o provider suporta init containers via configuração específica.

Consequências positivas

flexibilidade máxima de cloud target;
testabilidade local completa (`docker-compose.prod.yml`);
CI pode validar os Dockerfiles sem conta em cloud provider;
operações de build/run são idênticas em todos os ambientes.

Consequências negativas

sem aproveitamento de features específicas de provider (ex: Fly.io Machines, AWS Fargate Spot, Cloud Run concurrency);
`docker-compose.prod.yml` é uma referência — produção real pode precisar de arquivos de configuração adicionais do provider escolhido;
sem auto-scaling configurado — depende do provider para configurar após o deploy.

Alternativas rejeitadas

**Fly.io desde o início**: rejeitado — exigiria conta Fly.io em CI para validação dos `fly.toml`; acoplaria o repositório a um provider sem decisão de cloud formalizada.

**AWS ECS desde o início**: rejeitado — task definitions, IAM roles, e ECR requerem AWS account e maior complexidade de configuração antes de qualquer feature de produto.

**Railway**: rejeitado como target inicial — Railway suporta Dockerfiles padrão; configuração específica seria adicionada depois se escolhido.

Impactos

Código:
- Nenhuma alteração de código de negócio.
- `next.config.js` precisa ter `output: 'standalone'` para frontends.

Infraestrutura:
- 3 Dockerfiles + 3 `.dockerignore`.
- `docker-compose.prod.yml` como referência de deploy single-server.
- `docs/configuration.md` com todas as variáveis de ambiente.

CI:
- Job de build valida os 3 Dockerfiles com `docker build`.
- Não faz push para registry — apenas valida que as imagens constroem.

Migração ou reversão

Para adotar Fly.io: adicionar `fly.toml` por app apontando para o Dockerfile existente. Nenhuma alteração de Dockerfile.
Para adotar ECS: criar task definitions usando as imagens geradas pelos Dockerfiles existentes. Nenhuma alteração de Dockerfile.
Para adotar Railway: Railway detecta Dockerfile automaticamente. Nenhuma configuração adicional.

Referências

TASK-060 — Production Infrastructure & Deployment
ADR-007 — Autenticação própria (JWT_SECRET como env obrigatório em production)
ADR-008 — Object storage port-based (variáveis de storage como env em runtime)
Next.js Standalone Output: https://nextjs.org/docs/advanced-features/output-file-tracing
Docker multi-stage builds: https://docs.docker.com/develop/develop-images/multistage-build/
