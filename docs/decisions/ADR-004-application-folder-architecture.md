ADR-004 — Arquitetura de pastas das aplicações

Status

ACCEPTED

Data

2026-07-28

Contexto

O projeto possui múltiplas aplicações sendo desenvolvidas em paralelo por agentes de IA e pessoas. Sem uma estrutura de pastas explícita e documentada, cada tarefa tende a organizar o código de forma diferente, criando:

* inconsistência entre a API e o frontend;
* mistura de responsabilidades entre camadas;
* dificuldade para navegar e localizar código;
* acoplamento acidental entre módulos;
* regras arquiteturais invisíveis e não aplicáveis automaticamente;
* paletas de design duplicadas entre aplicações.

A ausência de um padrão também dificulta o uso consistente por agentes de IA, que precisam de contexto previsível para tomar decisões corretas.

Decisão

Adotar estruturas de pastas padronizadas para backend e frontend, com um pacote de design tokens compartilhado entre as aplicações web.

Estrutura do backend

A API utiliza arquitetura hexagonal com DDD pragmático:

```text
apps/api/
├── src/
│   ├── main.ts                 — bootstrap da aplicação
│   ├── app.module.ts           — composição do módulo raiz
│   │
│   ├── platform/               — infraestrutura transversal (não contém regras de negócio)
│   │   ├── config/             — variáveis de ambiente validadas (Zod)
│   │   ├── database/           — PrismaService, módulo de banco
│   │   ├── health/             — health checks (liveness, readiness)
│   │   ├── http/               — filtros, pipes, interceptors, guards globais
│   │   ├── messaging/          — configuração de filas e publishers
│   │   ├── observability/      — logging, métricas, tracing
│   │   └── security/           — CORS, helmet, configurações de segurança
│   │
│   ├── modules/                — módulos de negócio
│   │   └── [module]/
│   │       ├── domain/         — entidades, value objects, eventos, erros, ports
│   │       ├── application/    — casos de uso, commands, queries, DTOs, ports
│   │       ├── infrastructure/ — repositories Prisma, adapters externos, mappers
│   │       ├── presentation/   — controllers, requests, responses, presenters
│   │       └── [module].module.ts
│   │
│   └── shared/
│       └── kernel/             — somente código comprovadamente compartilhado por múltiplos módulos
│
└── test/
    ├── e2e/
    ├── integration/
    ├── contract/
    └── concurrency/
```

Regras de dependência do backend:

```text
Permitido:
  presentation → application → domain
  infrastructure → application/domain
  platform → composição e infraestrutura transversal

Proibido:
  domain → qualquer coisa de infraestrutura, NestJS, Prisma, Redis, SDKs externos
  application → Prisma, NestJS, Fastify, SDKs externos
  módulo A → implementação interna de módulo B
```

A comunicação entre módulos deve ocorrer por: port público, serviço de aplicação público, facade, evento ou contrato.

Estrutura do frontend

As aplicações web utilizam arquitetura orientada por features:

```text
apps/[web-app]/src/
├── app/                        — rotas Next.js, layouts, páginas, metadata
├── features/                   — comportamentos específicos do produto
│   └── [feature]/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── schemas/
│       ├── types/
│       ├── tests/
│       └── index.ts            — contrato público da feature
└── shared/                     — código genérico e reutilizável entre features
    ├── api/                    — cliente tipado da API
    ├── config/                 — variáveis de ambiente validadas
    ├── hooks/
    ├── lib/
    ├── types/
    └── ui/
        ├── primitives/         — elementos básicos (Button, Input, Badge...)
        ├── composites/         — combinações genéricas (SearchField, FormField...)
        └── sections/           — composições maiores (Header, Sidebar, DataTable...)
```

A hierarquia conceitual de UI segue o Atomic Design simplificado como referência para os componentes genéricos em `shared/ui`. Não usar as nomenclaturas atoms, molecules, organisms, templates, pages.

Páginas em `app/` devem ser pequenas — composições de features, não implementações.

Features não devem importar implementações internas de outras features. Quando um elemento precisar ser compartilhado: expor por `index.ts` ou promover para `shared/`.

Design tokens compartilhados

As paletas e tokens semânticos ficam centralizados em:

```text
packages/design-tokens/
└── tokens.css
```

Consumido por todas as aplicações web. Nenhuma aplicação define sua própria paleta de marca. As aplicações importam o pacote e mapeiam os tokens semânticos para utilities Tailwind via `@theme inline`.

Três níveis de tokens:
1. Primitivos — escala de valores brutos (ex: `--brand-500`)
2. Semânticos — função visual (ex: `--primary`, `--destructive`, `--success`)
3. Componentes — tokens específicos de um componente compartilhado (criados somente quando necessário)

Os componentes consomem apenas tokens semânticos. Nunca valores hexadecimais ou OKLCH diretamente no código.

Razões

* previsibilidade: toda IA e pessoa sabe onde localizar e colocar cada tipo de código;
* separação de responsabilidades: platform, modules e shared têm fronteiras claras;
* testabilidade: o domínio é TypeScript puro, testável sem framework;
* crescimento incremental: novas pastas são criadas conforme necessidade real;
* consistência visual: tokens centralizados impedem paletas divergentes.

Consequências positivas

* agentes de IA conseguem navegar o código com contexto limitado;
* domínio não contamina com dependências de infraestrutura;
* módulos são extraíveis gradualmente;
* tokens visuais são atualizáveis em um único arquivo;
* shadcn/ui funciona com os tokens semânticos.

Trade-offs

* mais diretórios que uma estrutura plana inicial;
* requer disciplina para não colocar código no lugar errado;
* `shared/kernel` pode crescer indevidamente se não for guardado.

Alternativas rejeitadas

Estrutura por camada técnica (controllers/, services/, repositories/ na raiz)

Rejeitada porque impede modularização e dificulta extração futura de módulos.

Nomenclatura Atomic Design (atoms/, molecules/, organisms/)

Rejeitada porque o Atomic Design é usado como referência conceitual, não como estrutura literal de pastas. Os nomes atoms e molecules adicionam vocabulário sem clareza suficiente para este projeto.

Biblioteca completa de componentes desde o início

Rejeitada porque antecipa necessidade que pode não existir. Componentes são promovidos para packages/ui somente após uso real e estável em mais de uma aplicação.

Tokens por aplicação

Rejeitado porque cria divergência visual. Uma mudança de marca exigiria atualizar múltiplos arquivos.

Impactos

Código

Todos os arquivos existentes reorganizados conforme o novo padrão. Nenhum comportamento observável alterado.

Tooling

O ESLint existente pode ser estendido com import/no-restricted-paths para reforçar automaticamente os limites arquiteturais.

Documentação

AGENTS.md e ARCHITECTURE.md atualizados com a estrutura de pastas. REPOSITORY_MAP.md atualizado com o novo pacote. Futuros ADRs de módulo devem referenciar este ADR.
