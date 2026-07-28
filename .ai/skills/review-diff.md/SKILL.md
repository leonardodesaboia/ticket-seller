Skill: Review Diff
Quando utilizar

Use depois de uma implementação e antes do merge.

Entrada
diff;
tarefa;
documentos do módulo;
testes alterados.
Verificações
Arquitetura
dependência proibida;
regra em controller;
Prisma no domínio;
SDK externo fora de adapter;
acoplamento entre módulos.
Segurança
autorização;
tenant;
exposição de dados;
logs;
secrets;
validação;
rate limit.
Dados
constraint;
transação;
índice;
paginação;
migration.
Concorrência
race condition;
operação não atômica;
lock inadequado;
estado inválido.
Idempotência
webhook;
comando;
mensagem;
emissão;
reembolso;
check-in.
Testes
ausência de casos de erro;
ausência de teste multi-tenant;
ausência de teste concorrente;
teste excessivamente mockado.
Saída

Classificar cada problema:

BLOQUEANTE;
ALTO;
MÉDIO;
BAIXO.

Não modificar arquivos durante o review.