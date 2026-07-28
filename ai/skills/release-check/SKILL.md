Skill: Release Check
Quando utilizar

Antes de deploy em staging ou produção.

Verificações
Código

lint;

typecheck;

testes unitários;

integração;

E2E;

build.

Banco

migration validada;

migration reversível ou progressiva;

backup;

impacto avaliado.

Configuração

variáveis documentadas;

secrets existentes;

nenhuma credencial no código;

feature flags revisadas.

Segurança

scan de dependências;

scan de imagem;

scan de secrets;

endpoints administrativos revisados.

Operação

health check;

readiness;

logs;

métricas;

alertas;

rollback.

Pagamentos

webhooks configurados;

assinatura validada;

idempotência;

sandbox separado de produção;

reconciliação disponível.

Saída
APROVADO;
APROVADO COM RESSALVAS;
BLOQUEADO.