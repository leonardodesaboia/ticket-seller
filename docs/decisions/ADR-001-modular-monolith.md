ADR-001 — Utilizar monólito modular
Status

ACCEPTED

Data

2026-07-28

Contexto

O marketplace iniciará com capacidade reduzida, aproximadamente 100 usuários ativos simultaneamente.

Apesar disso, os módulos de estoque, pedidos, pagamentos, ingressos, check-in e financeiro possuem regras complexas e poderão precisar de escalabilidade independente futuramente.

Iniciar com microserviços aumentaria:

custo;
quantidade de deploys;
comunicação distribuída;
risco de inconsistência;
dificuldade de testes;
necessidade de observabilidade distribuída;
esforço operacional.

Uma aplicação monolítica sem limites claros dificultaria futuras extrações.

Decisão

Utilizar um monólito modular.

Os módulos serão separados por capacidades de negócio, com contratos explícitos e regras de dependência.

A aplicação poderá ser executada em processos diferentes:

API;
worker;
scheduler.

Módulos poderão ser extraídos gradualmente quando houver necessidade concreta.

Razões
menor complexidade operacional;
transações locais mais simples;
deploy inicial mais simples;
melhor produtividade;
possibilidade de escalabilidade horizontal;
possibilidade de extração posterior;
menor custo inicial.
Consequências positivas
início rápido;
testes de integração mais simples;
consistência transacional;
menor quantidade de infraestrutura;
melhor contexto para desenvolvimento assistido por IA.
Consequências negativas
banco inicialmente compartilhado;
limites entre módulos precisam ser fiscalizados;
uma mudança mal estruturada pode aumentar acoplamento;
crescimento exige disciplina arquitetural.
Alternativas consideradas
Microserviços desde o MVP

Rejeitado por aumentar custo e complexidade antes de existir demanda.

Monólito sem modularização

Rejeitado porque dificultaria manutenção, testes e extração futura.

Funções serverless independentes

Rejeitado como arquitetura principal porque aumentaria fragmentação e complexidade transacional.

Impactos
Código

Cada módulo possuirá domínio, aplicação, infraestrutura e apresentação.

Infraestrutura

Inicialmente poucos processos containerizados.

Segurança

Permissões e isolamento multi-tenant continuam obrigatórios dentro de cada módulo.

Custos

Redução de custos operacionais no MVP.

Escalabilidade

Escalabilidade horizontal inicialmente; extração gradual posteriormente.

Migração ou reversão

Módulos críticos poderão ser extraídos utilizando contratos, eventos e o padrão Strangler Fig.