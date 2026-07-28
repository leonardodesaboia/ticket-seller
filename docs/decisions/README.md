Architecture Decision Records

Este diretório armazena decisões arquiteturais permanentes.

Quando criar um ADR

Criar ADR quando houver decisão sobre:

arquitetura;
banco de dados;
framework;
provedor externo;
estratégia de autenticação;
estratégia de mensageria;
estratégia multi-tenant;
mudança de tecnologia;
padrão que afetará vários módulos;
decisão difícil de reverter.

Não criar ADR para:

correção simples;
nome de variável;
mudança estética;
refatoração local;
implementação que já segue decisão existente.
Numeração
ADR-001
ADR-002
ADR-003
Estados
PROPOSED;
ACCEPTED;
SUPERSEDED;
REJECTED.
Regra

Um ADR aceito não deve ser apagado.

Caso seja substituído, altere para SUPERSEDED e referencie o novo ADR.