ADR-002 — Utilizar PostgreSQL como banco transacional
Status

ACCEPTED

Data

2026-07-28

Contexto

A plataforma possuirá operações críticas de:

estoque;
reserva;
pagamento;
emissão;
check-in;
ledger;
repasses;
auditoria.

Essas operações exigem:

transações;
constraints;
concorrência;
locks;
índices;
integridade referencial;
consultas relacionais.
Decisão

Utilizar PostgreSQL como banco de dados transacional oficial.

Prisma será utilizado em operações convencionais.

SQL nativo será permitido e recomendado em:

reserva atômica;
check-in concorrente;
ledger;
processamento de outbox;
locks;
consultas financeiras críticas;
otimizações específicas.
Razões
transações ACID;
controle de concorrência;
constraints;
integridade relacional;
recursos avançados;
grande oferta de serviços gerenciados;
portabilidade entre provedores.
Consequências positivas
consistência de estoque;
operações financeiras seguras;
suporte a consultas complexas;
possibilidade de Row-Level Security;
disponibilidade em várias nuvens.
Consequências negativas
exige atenção com pool de conexões;
exige índices adequados;
relatórios pesados precisam ser controlados;
não existe compatibilidade automática com bancos NoSQL.
Alternativas consideradas
MongoDB

Rejeitado como banco principal por não ser a melhor opção para o conjunto de invariantes relacionais e financeiras.

MySQL

Seria tecnicamente viável, mas PostgreSQL foi escolhido por seus recursos de concorrência, extensibilidade e consistência com a arquitetura definida.

Banco somente serverless proprietário

Rejeitado por aumentar acoplamento ao fornecedor.

Impactos
Código

Repositories isolam acesso ao banco.

Infraestrutura

Produção utilizará PostgreSQL gerenciado quando possível.

Segurança

Poderá ser aplicada Row-Level Security como defesa adicional.

Custos

O banco provavelmente será o principal custo fixo da infraestrutura.

Escalabilidade

Escala vertical inicial, réplicas e particionamento quando necessário.

Migração ou reversão

A aplicação poderá migrar entre provedores PostgreSQL sem alterar o domínio.

Trocar para outro tipo de banco exigiria nova decisão arquitetural.