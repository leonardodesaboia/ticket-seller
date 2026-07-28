Workflow REVIEW
Objetivo

Revisar somente o diff informado.

O revisor deve verificar
Arquitetura
imports proibidos;
dependências invertidas;
regra de negócio em controller;
SDK externo fora de adapter;
duplicação de fontes oficiais.
Segurança
autorização;
acesso multi-tenant;
exposição de dados;
secrets;
logs sensíveis;
validação;
rate limiting.
Concorrência
race conditions;
estoque negativo;
check-in duplicado;
transações incompletas;
locks inadequados.
Idempotência
comando repetido;
webhook duplicado;
mensagem duplicada;
criação duplicada de recursos.
Banco
migration alterada;
ausência de constraint;
índice inadequado;
consulta sem paginação;
N+1;
transação longa.
Testes
casos felizes;
casos de erro;
concorrência;
multi-tenancy;
idempotência;
contratos.
Classificação
BLOQUEANTE: não pode ser integrado;
ALTO: risco relevante de segurança, dados ou comportamento;
MÉDIO: problema de manutenção ou confiabilidade;
BAIXO: melhoria não obrigatória.
Saída

Para cada problema:

Classificação:
Arquivo:
Trecho:
Problema:
Impacto:
Correção recomendada: