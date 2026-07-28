Uso dos subagentes no Claude Code
1. Verificar arquivos
find .claude/agents -type f -name "*.md" | sort
2. Reiniciar o Claude Code

Necessário quando .claude/agents/ foi criado depois que a sessão atual já estava aberta.

3. Verificar agentes

Dentro do Claude Code:

/agents
/doctor

Confirme que não existem nomes duplicados.

4. Iniciar o orquestrador

No terminal, na raiz do projeto:

claude --agent project-orchestrator
5. Prompt inicial normal
Leia as fontes oficiais do projeto e atue como orquestrador.

Objetivo atual:

[DESCREVA A FEATURE OU ETAPA]

Primeiro trabalhe apenas em planejamento.

Não implemente e não inicie subagentes ainda.

Apresente:

1. entendimento;
2. tarefas;
3. dependências;
4. propriedade dos arquivos;
5. o que pode executar em paralelo;
6. contratos;
7. migrations;
8. dependências novas;
9. riscos;
10. ordem de integração;
11. pontos que precisam da minha aprovação.
6. Autorizar execução

Depois de revisar o plano:

Plano aprovado.

Crie os arquivos de tarefa necessários e execute o plano.

Regras:

- utilize no máximo três implementadores simultâneos;
- utilize worktrees isolados;
- congele contratos antes de iniciar tarefas dependentes;
- não permita migrations simultâneas;
- não permita alterações concorrentes em arquivos globais;
- use code-reviewer em todo código;
- use security-reviewer nas partes sensíveis;
- corrija achados bloqueantes e altos;
- integre uma branch por vez;
- execute a validação global depois de cada integração relevante;
- não faça deploy;
- pare somente nos pontos de aprovação humana definidos.
7. Acompanhar execução

Dentro do Claude Code:

/tasks

Use a lista para acompanhar subagentes em background.

8. Solicitar agente explicitamente

Quando necessário:

@agent-code-reviewer revise o diff da TASK-012 contra main.
@agent-security-reviewer revise a implementação de autenticação da TASK-015.
@agent-task-planner divida a criação do checkout em tarefas independentes.
9. Resultado esperado de cada implementador

Todo implementador deve retornar:

Tarefa:
Branch:
Commit:
Arquivos alterados:
Testes:
Dependências solicitadas:
Mudanças de banco solicitadas:
Riscos:
Pendências:

Sem branch e commit, a tarefa não entra na integração.

10. Resultado esperado do orquestrador

Ao final:

Tarefas concluídas
Subagentes executados
Commits produzidos
Branches integradas
Testes executados
Reviews realizados
Problemas corrigidos
Pendências
Próxima etapa
11. Regras práticas
não execute dois Database Owners;
não execute duas tarefas no mesmo módulo simultaneamente;
não deixe implementadores alterar lockfile;
não integre código sem review;
não acumule muitas branches antes de integrar;
não execute mais de três implementadores no início;
não permita que o implementador aprove o próprio trabalho;
não permita deploy automático.
12. Primeiro uso recomendado

Para a fase atual:

Objetivo:

Inicializar a fundação executável do projeto.

Sequência:

1. TASK-002 — Monorepo Bootstrap;
2. TASK-003 — Shared Tooling;
3. depois, em paralelo:
   - API Bootstrap;
   - Local Infrastructure;
   - Marketplace Bootstrap;
4. Backoffice Bootstrap após validar a estrutura do primeiro frontend.

Monorepo e Shared Tooling devem ser sequenciais.

Não inicie frontend ou backend antes dessas duas tarefas serem integradas.