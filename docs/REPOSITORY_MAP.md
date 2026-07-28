Mapa do repositório
Raiz
AGENTS.md

Regras globais para agentes e pessoas.

Aplicações
apps/

Aplicações executáveis.

Previstas:

apps/
├── api/
├── worker/
├── scheduler/
├── marketplace-web/
├── backoffice-web/
└── checkin-pwa/
Pacotes
packages/

Código compartilhado que não representa aplicação executável.

Previstos:

packages/
├── api-client/
├── contracts/
├── observability/
├── config/
├── security/
├── testing/
└── ui/

Entidades do domínio do backend não devem ser compartilhadas com o frontend.

Documentação
docs/

Fonte oficial de conhecimento.

IA
.ai/
├── tasks/
├── reports/
├── workflows/
├── skills/
├── scripts/
└── templates/
Infraestrutura
infra/
├── docker/
├── terraform/
└── environments/
Testes
tests/
├── integration/
├── concurrency/
├── contract/
├── e2e/
└── load/

Testes específicos do módulo podem ficar próximos ao código quando isso melhorar a manutenção.