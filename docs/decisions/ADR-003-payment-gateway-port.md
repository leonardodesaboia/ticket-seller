ADR-003 — Isolar pagamentos por PaymentGateway
Status

ACCEPTED

Data

2026-07-28

Contexto

O provedor de pagamentos ainda não foi escolhido.

Possibilidades incluem:

Stripe;
Asaas;
PagBank;
Pagar.me;
outros provedores.

Os fornecedores possuem diferenças em:

Pix;
cartão;
boleto;
split;
subcontas;
recebedores;
KYC;
reembolso;
chargeback;
repasse;
idempotência.

Acoplar o domínio diretamente a um SDK dificultaria substituição e testes.

Decisão

Criar uma porta PaymentGateway.

Cada provedor será implementado em um adapter independente.

O domínio trabalhará apenas com:

estados internos;
capacidades;
identificadores internos;
erros internos;
comandos próprios.

O MVP terá:

FakePaymentGateway;
apenas um adapter real inicialmente.
Razões
reduzir acoplamento;
facilitar testes;
permitir comparação entre provedores;
impedir propagação de modelos externos;
facilitar futura substituição;
manter o domínio independente.
Consequências positivas
integração substituível;
testes de contrato;
desenvolvimento sem PSP real;
status internos consistentes;
SDK isolado.
Consequências negativas
necessidade de mapeamento;
diferenças entre provedores não desaparecem;
interface precisa ser desenhada com cuidado;
capabilities precisam ser mantidas.
Alternativas consideradas
Utilizar diretamente o primeiro SDK escolhido

Rejeitado por gerar acoplamento precoce.

Criar uma interface baseada no menor denominador comum

Rejeitado porque esconderia recursos importantes de cada provedor.

Implementar vários provedores no MVP

Rejeitado por aumentar escopo e custo sem validação do produto.

Impactos
Código

Cada adapter deve passar pela mesma suíte de testes de contrato.

Infraestrutura

Nenhum impacto relevante inicialmente.

Segurança

Dados de cartão devem ser tokenizados pelo PSP.

Custos

Permite comparar custos e substituir o fornecedor no futuro.

Escalabilidade

Workers de pagamento poderão ser separados posteriormente.

Migração ou reversão

Um novo adapter poderá ser adicionado sem alterar o domínio.

A troca de PSP exigirá processo de migração de contas e operações pendentes.