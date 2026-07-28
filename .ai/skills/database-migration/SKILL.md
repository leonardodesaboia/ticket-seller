Skill: Database Migration
Quando utilizar

Use para qualquer mudança de schema.

Procedimento
Confirmar necessidade da mudança.
Ler o modelo e queries afetadas.
Criar migration nova.
Nunca editar migration aplicada.
Adicionar constraints.
Avaliar índices.
Planejar dados existentes.
Avaliar rollback.
Testar em PostgreSQL real.
Atualizar documentação.
Checklist

migration nova;

nome descritivo;

valores default avaliados;

NOT NULL seguro;

foreign keys;

índices;

impacto de lock;

volume de dados;

compatibilidade durante deploy;

rollback ou correção progressiva;

teste de integração.

Proibições
alterar migration aplicada;
apagar dados silenciosamente;
adicionar coluna obrigatória sem estratégia;
criar índice pesado sem avaliar impacto;
utilizar SQLite como validação final;
executar diretamente em produção.