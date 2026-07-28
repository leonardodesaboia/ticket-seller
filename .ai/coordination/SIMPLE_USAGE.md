# Método oficial e simplificado de desenvolvimento com IA

## 1. Finalidade deste arquivo

Este arquivo define o fluxo oficial de desenvolvimento assistido por IA deste projeto.

Quando o usuário solicitar:

```text
Leia .ai/coordination/SIMPLE_USAGE.md e siga exatamente o fluxo definido nele.

Quero implementar:
[DESCRIÇÃO]
```

o agente principal deve assumir automaticamente o papel de:

* orquestrador;
* coordenador técnico;
* responsável pelo planejamento;
* responsável pela delegação;
* responsável pela revisão;
* responsável pela integração;
* responsável pela validação final;
* responsável pela atualização da documentação.

O usuário não deve precisar gerenciar manualmente:

* subagentes;
* branches;
* worktrees;
* ownership;
* dependências entre tarefas;
* ordem de integração;
* revisores;
* merges;
* conflitos;
* comandos de validação;
* atualização dos arquivos de coordenação.

O agente principal deve cuidar dessas atividades.

---

# 2. Regra principal

> O usuário descreve o resultado desejado, aprova o plano e confere o resultado final. O agente principal administra todo o processo técnico entre essas etapas.

O fluxo obrigatório é:

```text
Solicitação do usuário
→ leitura do contexto
→ planejamento
→ aprovação humana
→ divisão em tarefas
→ delegação
→ implementação
→ revisão independente
→ correções
→ integração
→ validação global
→ atualização da documentação
→ relatório final
```

---

# 3. Papel do agente principal

O agente que receber a solicitação deve atuar como orquestrador.

Ele deve:

1. entender o pedido;
2. consultar as fontes oficiais;
3. identificar o estado atual;
4. localizar os módulos afetados;
5. verificar decisões arquiteturais;
6. definir o escopo;
7. identificar riscos;
8. dividir o trabalho em tarefas;
9. definir dependências;
10. identificar tarefas paralelas;
11. proteger arquivos compartilhados;
12. apresentar o plano;
13. aguardar aprovação;
14. delegar tarefas independentes;
15. acompanhar os subagentes;
16. solicitar revisões;
17. coordenar correções;
18. integrar as alterações;
19. executar os testes;
20. atualizar a documentação;
21. apresentar o resultado final.

O agente principal não deve exigir que o usuário defina:

* qual subagente utilizar;
* quais arquivos alterar;
* quais testes executar;
* quais branches criar;
* quais worktrees criar;
* qual ordem de integração usar.

Essas decisões operacionais pertencem ao agente principal.

---

# 4. Fontes oficiais do projeto

Antes de planejar qualquer implementação, o agente deve consultar as fontes oficiais necessárias.

## 4.1 Leitura obrigatória inicial

Ler nesta ordem:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/CURRENT_STATE.md`
4. `docs/PROJECT.md`
5. `docs/ARCHITECTURE.md`
6. `docs/REPOSITORY_MAP.md`
7. `.ai/workflows/FEATURE_FLOW.md`
8. `.ai/coordination/SIMPLE_USAGE.md`

## 4.2 Leitura obrigatória conforme a tarefa

Depois da leitura inicial, consultar somente o que for relevante.

### Regras do domínio

```text
docs/DOMAIN.md
```

### Documentação de módulos

```text
docs/modules/
```

Ler apenas os módulos afetados pela solicitação.

Exemplos:

```text
docs/modules/identity.md
docs/modules/organizations.md
docs/modules/events.md
docs/modules/inventory.md
docs/modules/reservations.md
docs/modules/orders.md
docs/modules/payments.md
docs/modules/tickets.md
docs/modules/checkin.md
```

### Decisões arquiteturais

```text
docs/decisions/
```

Consultar os ADRs relacionados.

### Fluxos de trabalho

```text
.ai/workflows/PLAN.md
.ai/workflows/IMPLEMENT.md
.ai/workflows/REVIEW.md
.ai/workflows/FIX.md
```

### Coordenação paralela

```text
.ai/coordination/PARALLEL_WORK.md
.ai/coordination/ACTIVE_TASKS.md
.ai/coordination/OWNERSHIP.md
.ai/coordination/DEPENDENCIES.md
.ai/coordination/INTEGRATION_QUEUE.md
```

### Templates

```text
.ai/templates/TASK_TEMPLATE.md
.ai/templates/PARALLEL_TASK_TEMPLATE.md
.ai/templates/ADR_TEMPLATE.md
.ai/templates/REPORT_TEMPLATE.md
```

### Skills

Consultar somente quando aplicável:

```text
.ai/skills/implement-task/SKILL.md
.ai/skills/review-diff/SKILL.md
.ai/skills/database-migration/SKILL.md
.ai/skills/payment-adapter/SKILL.md
.ai/skills/security-review/SKILL.md
.ai/skills/release-check/SKILL.md
```

## 4.3 Regras de leitura

O agente não deve ler o repositório inteiro indiscriminadamente.

Deve:

* começar pelas fontes oficiais;
* localizar apenas os módulos relacionados;
* ler somente os arquivos de código necessários;
* evitar carregar contexto irrelevante;
* utilizar busca para localizar implementações existentes;
* preferir contexto pequeno e específico.

Conversas anteriores não substituem os arquivos oficiais.

Quando houver divergência, a prioridade é:

```text
AGENTS.md
→ ADRs aceitos
→ ARCHITECTURE.md
→ documentação do módulo
→ tarefa aprovada
→ código existente
```

---

# 5. Resumo técnico do projeto

O agente deve considerar como base:

## Arquitetura

* monólito modular;
* arquitetura hexagonal;
* ports e adapters;
* DDD pragmático;
* PostgreSQL como fonte transacional;
* Redis apenas como suporte temporário;
* transactional outbox;
* consumidores idempotentes;
* processos stateless;
* contratos versionados.

## Backend

* Node.js;
* TypeScript strict;
* NestJS;
* Fastify;
* REST;
* OpenAPI;
* RFC 9457 para erros;
* Prisma para operações comuns;
* SQL nativo quando necessário para concorrência crítica.

## Frontend

* Next.js;
* React;
* TypeScript strict;
* Tailwind CSS;
* shadcn/ui;
* React Hook Form;
* Zod;
* TanStack Query quando necessário;
* cliente tipado baseado na OpenAPI.

## Infraestrutura

* pnpm workspaces;
* Turborepo;
* Docker;
* Docker Compose;
* PostgreSQL;
* Redis;
* armazenamento compatível com S3;
* observabilidade com OpenTelemetry;
* logs estruturados com Pino.

## Princípios obrigatórios

* dinheiro em unidades inteiras;
* isolamento por `organizationId`;
* PostgreSQL como fonte oficial de estoque;
* operações críticas idempotentes;
* ledger imutável;
* webhooks verificados e deduplicados;
* nenhum SDK externo dentro do domínio;
* nenhuma regra de negócio em controllers;
* nenhuma dependência estrutural sem aprovação;
* nenhuma abstração sem caso concreto.

As versões e decisões específicas devem ser confirmadas nos arquivos oficiais.

---

# 6. Como analisar a solicitação

Ao receber um pedido, o agente deve identificar:

## Produto

* quem utilizará;
* qual problema será resolvido;
* qual comportamento deve ser observável;
* quais resultados são esperados;
* o que explicitamente não faz parte da entrega.

## Domínio

* entidades;
* estados;
* transições;
* invariantes;
* regras de negócio;
* eventos de domínio;
* permissões.

## Arquitetura

* módulos afetados;
* direção das dependências;
* ports necessários;
* adapters necessários;
* contratos existentes;
* impacto em componentes compartilhados.

## Dados

* tabelas;
* colunas;
* constraints;
* índices;
* migrations;
* transações;
* compatibilidade com dados existentes.

## Segurança

* autenticação;
* autorização;
* isolamento multi-tenant;
* dados pessoais;
* dados financeiros;
* validação;
* rate limiting;
* logs;
* secrets;
* superfície pública.

## Concorrência

* ações simultâneas;
* race conditions;
* duplicação;
* estoque;
* pagamentos;
* reembolsos;
* emissão de ingressos;
* check-in;
* transferências;
* repasses.

## Idempotência

* comandos repetidos;
* retries;
* webhooks;
* mensagens;
* tarefas assíncronas;
* chamadas externas;
* efeitos duplicados.

## Qualidade

* testes unitários;
* testes de integração;
* testes de contrato;
* testes E2E;
* testes de concorrência;
* observabilidade;
* documentação.

---

# 7. Primeira resposta obrigatória: planejamento

O agente não deve começar implementando imediatamente.

Primeiro deve apresentar um plano simples e compreensível.

A resposta de planejamento deve conter:

## Solicitação entendida

Resumo do que será entregue.

## Fora do escopo

Lista do que não será implementado.

## Tarefas propostas

| Tarefa | Objetivo | Dependências | Pode ser paralela | Responsável sugerido |
| ------ | -------- | ------------ | ----------------- | -------------------- |

## Módulos afetados

Listar somente os módulos relacionados.

## Arquivos ou áreas afetadas

Indicar:

* backend;
* frontend;
* banco;
* infraestrutura;
* contratos;
* testes;
* documentação.

## Contratos

Informar:

* contratos existentes utilizados;
* contratos que precisam ser criados;
* contratos que precisam ser alterados;
* contratos que devem ficar congelados.

## Banco de dados

Informar:

* necessidade de migration;
* natureza aditiva ou destrutiva;
* constraints;
* índices;
* riscos.

## Dependências

Informar:

* dependências novas;
* justificativa;
* alternativas;
* necessidade de aprovação.

## Riscos

Apontar riscos reais:

* segurança;
* concorrência;
* idempotência;
* multi-tenancy;
* compatibilidade;
* integração;
* escopo.

## Ordem de execução

Mostrar a sequência de implementação e integração.

## Aprovações necessárias

Destacar decisões que precisam do usuário.

Depois disso, aguardar aprovação explícita.

---

# 8. Resposta padrão do usuário para aprovação

Quando o plano estiver correto, o usuário poderá responder apenas:

```text
Plano aprovado.

Execute conforme o SIMPLE_USAGE.md.

Não aumente o escopo, não faça deploy e pare somente nos pontos que exigem aprovação humana.
```

Essa resposta autoriza o agente principal a:

* criar tarefas;
* utilizar subagentes;
* criar isolamento de trabalho;
* implementar;
* revisar;
* corrigir;
* testar;
* integrar;
* atualizar a documentação.

---

# 9. Execução após aprovação

Depois da aprovação, o agente deve seguir esta ordem:

```text
1. Criar tarefas
2. Definir dependências
3. Definir propriedade de arquivos
4. Identificar paralelismo seguro
5. Proteger arquivos compartilhados
6. Criar ambientes isolados
7. Delegar tarefas
8. Acompanhar implementações
9. Executar testes locais
10. Realizar revisão independente
11. Corrigir problemas
12. Integrar uma tarefa por vez
13. Executar validação global
14. Atualizar documentação
15. Apresentar relatório final
```

---

# 10. Criação das tarefas

Para cada unidade de trabalho, o agente principal deve criar ou utilizar uma tarefa em:

```text
.ai/tasks/
```

A tarefa deve conter:

* identificador;
* título;
* objetivo;
* resultado observável;
* status;
* dependências;
* propriedade exclusiva;
* arquivos permitidos;
* arquivos proibidos;
* contratos consumidos;
* contratos produzidos;
* requisitos;
* invariantes;
* segurança;
* multi-tenancy;
* concorrência;
* idempotência;
* fora do escopo;
* critérios de aceite;
* comandos de validação;
* formato de conclusão.

Uma tarefa deve ter apenas um objetivo principal.

Evitar tarefas vagas como:

```text
implementar backend;
fazer frontend;
criar módulo completo;
terminar sistema;
resolver tudo.
```

Preferir tarefas como:

```text
criar caso de uso CreateEvent;
persistir evento em estado DRAFT;
expor POST /events;
criar formulário de evento;
testar isolamento entre organizações.
```

---

# 11. Uso dos subagentes

O agente principal deve utilizar os subagentes disponíveis na ferramenta.

Exemplos de papéis:

* planner;
* backend implementer;
* frontend implementer;
* infrastructure implementer;
* database owner;
* test engineer;
* code reviewer;
* security reviewer;
* integrator.

A ferramenta pode utilizar nomes diferentes. O agente principal deve adaptar os papéis aos recursos disponíveis.

## Regras

* no máximo três implementadores simultâneos no início;
* cada implementador recebe uma tarefa;
* cada implementador recebe contexto limitado;
* cada implementador possui propriedade exclusiva;
* nenhum implementador aprova o próprio trabalho;
* apenas um agente altera banco e migrations por vez;
* apenas um agente integra alterações;
* revisores devem ser independentes.

## Contexto enviado ao subagente

Enviar somente:

* `AGENTS.md`;
* tarefa;
* documentação do módulo;
* contrato relacionado;
* arquivos diretamente relevantes;
* testes relacionados.

Não enviar o repositório inteiro sem necessidade.

---

# 12. Paralelismo seguro

Tarefas podem executar em paralelo quando:

* não alteram os mesmos arquivos;
* não alteram o mesmo contrato;
* não alteram a mesma migration;
* não dependem de código ainda não integrado;
* possuem resultados independentes;
* possuem critérios de aceite próprios.

Exemplo seguro:

```text
API Bootstrap
Local Infrastructure
Marketplace Bootstrap
```

Exemplo seguro com contrato congelado:

```text
Backend de uma feature
Frontend da mesma feature
Testes de contrato
```

Exemplo proibido:

```text
duas migrations;
duas alterações no mesmo módulo;
duas alterações no package.json;
duas alterações no lockfile;
duas alterações no mesmo contrato;
duas tarefas no mesmo schema;
refatoração e feature no mesmo código.
```

Quando não houver independência clara, executar sequencialmente.

---

# 13. Isolamento de trabalho

Cada implementador deve trabalhar isoladamente.

Usar conforme a ferramenta disponível:

* worktrees;
* branches;
* ambientes isolados;
* threads isoladas;
* sandboxes independentes.

Duas IAs não devem editar simultaneamente o mesmo diretório ou conjunto de arquivos.

O agente principal é responsável por administrar esse isolamento.

O usuário não precisa criar manualmente worktrees ou branches.

---

# 14. Arquivos protegidos

Durante trabalhos paralelos, os seguintes arquivos devem possuir um único responsável:

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
turbo.json
AGENTS.md
CLAUDE.md
.codex/config.toml
compose.yaml
schema.prisma
prisma/migrations/**
packages/contracts/**
packages/api-client/**
packages/eslint-config/**
packages/typescript-config/**
packages/prettier-config/**
.github/workflows/**
openapi.json
```

Um implementador comum não deve alterar esses arquivos sem coordenação.

Quando precisar:

1. registrar a necessidade;
2. informar o agente principal;
3. delegar ao responsável;
4. integrar a alteração;
5. atualizar as tarefas dependentes.

---

# 15. Contratos compartilhados

Backend e frontend só devem trabalhar simultaneamente quando houver contrato definido.

O contrato deve incluir, quando aplicável:

* método HTTP;
* rota;
* parâmetros;
* request;
* response;
* erros;
* autenticação;
* autorização;
* exemplos;
* eventos;
* schemas.

Depois da aprovação, o contrato deve ser considerado congelado durante a implementação.

Quando um agente encontrar problema no contrato:

1. não alterar silenciosamente;
2. registrar solicitação;
3. informar impacto;
4. aguardar decisão do orquestrador;
5. atualizar tarefas dependentes.

---

# 16. Banco de dados

Somente um Database Owner pode alterar por vez:

* schema;
* migrations;
* constraints;
* índices;
* seeds;
* modelos Prisma.

## Regras

* migrations aplicadas nunca são modificadas;
* migrations novas devem ser criadas;
* mudanças destrutivas exigem aprovação;
* dados financeiros não devem ser apagados;
* dinheiro não usa ponto flutuante;
* recursos multi-tenant recebem `organizationId`;
* índices devem refletir consultas reais;
* constraints devem proteger invariantes;
* testes devem utilizar PostgreSQL real quando o comportamento depender dele.

## Fluxo

```text
Implementador identifica necessidade
→ cria solicitação de banco
→ Database Owner implementa
→ revisão
→ integração
→ tarefas dependentes são atualizadas
```

---

# 17. Dependências de pacotes

Implementadores não devem instalar dependências sem coordenação.

Quando uma dependência for necessária, registrar:

* pacote;
* aplicação;
* tipo;
* motivo;
* alternativas;
* impacto.

Dependências estruturais exigem aprovação humana.

O agente principal ou integrador deve aplicar alterações no:

```text
package.json
pnpm-lock.yaml
```

Depois, atualizar os trabalhos dependentes.

---

# 18. Implementação

Cada implementador deve:

1. reler a tarefa;
2. confirmar os arquivos permitidos;
3. implementar somente o plano;
4. criar testes;
5. executar validações;
6. revisar o próprio diff;
7. informar arquivos alterados;
8. informar testes;
9. informar riscos;
10. não fazer merge.

É proibido:

* aumentar escopo;
* refatorar código não relacionado;
* instalar dependência sem aprovação;
* alterar contrato congelado;
* alterar migration aplicada;
* esconder teste falhando;
* utilizar `any` sem justificativa;
* utilizar `@ts-ignore` para contornar erro;
* remover validação;
* criar `catch` vazio;
* registrar secrets;
* modificar arquivo fora da propriedade.

---

# 19. Revisão independente

Toda implementação deve passar por revisão de um agente diferente.

## Revisão técnica obrigatória

Verificar:

* escopo;
* arquitetura;
* dependências;
* qualidade;
* testes;
* contratos;
* dados;
* concorrência;
* idempotência;
* multi-tenancy;
* arquivos fora da propriedade.

## Revisão de segurança obrigatória quando envolver

* identidade;
* autenticação;
* autorização;
* organização;
* pagamentos;
* webhooks;
* uploads;
* dados pessoais;
* administração;
* repasses;
* check-in;
* endpoints públicos sensíveis;
* infraestrutura.

## Classificação

* `BLOQUEANTE`;
* `ALTO`;
* `MÉDIO`;
* `BAIXO`.

Problemas bloqueantes e altos impedem a integração.

Problemas médios devem ser corrigidos ou convertidos em tarefa explícita.

Problemas baixos podem ser registrados como melhoria.

---

# 20. Correções

O implementador deve corrigir somente os achados aprovados.

Não deve aproveitar a correção para:

* refatorar áreas extras;
* mudar contratos;
* adicionar funcionalidades;
* trocar bibliotecas;
* alterar arquitetura;
* reformatar arquivos não relacionados.

Depois das correções:

* executar novamente os testes afetados;
* realizar nova revisão quando necessário;
* confirmar que o escopo permanece limitado.

---

# 21. Integração

Somente um integrador deve integrar alterações.

A integração deve ocorrer uma tarefa por vez.

## Pré-condições

* implementação concluída;
* revisão aprovada;
* achados altos corrigidos;
* testes locais aprovados;
* dependências integradas;
* propriedade respeitada;
* nenhum contrato alterado indevidamente.

## Procedimento

```text
Atualizar base
→ revisar diff
→ integrar tarefa
→ resolver conflitos
→ executar testes
→ validar projeto
→ atualizar estado
→ seguir para a próxima tarefa
```

Não acumular muitas branches antes de testar.

## Conflitos

Ao encontrar conflito:

1. identificar o proprietário oficial;
2. preservar a implementação do proprietário;
3. adaptar a tarefa dependente;
4. não combinar automaticamente implementações divergentes;
5. executar novamente os testes;
6. registrar a resolução.

Conflitos arquiteturais exigem aprovação humana.

---

# 22. Validações obrigatórias

Executar conforme aplicável:

```bash
git diff --check
git diff --stat
git diff --name-status

pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:concurrency
pnpm build

.ai/scripts/check-foundation.sh
.ai/scripts/validate-changed-files.sh
.ai/scripts/validate-architecture.sh
.ai/scripts/validate-migrations.sh
.ai/scripts/test-affected.sh
.ai/scripts/scan-secrets.sh
.ai/scripts/summarize-diff.sh
```

O agente deve executar somente comandos existentes e aplicáveis.

Não deve inventar sucesso para um comando inexistente ou não executado.

Quando um comando não puder ser executado, informar claramente:

* comando;
* motivo;
* impacto;
* validação alternativa realizada.

---

# 23. Atualização da documentação

Após concluir a implementação, o agente principal deve avaliar:

## Atualizar `docs/CURRENT_STATE.md`

Quando houver progresso relevante.

## Atualizar documentação do módulo

Quando houver:

* nova regra;
* novo estado;
* nova transição;
* novo evento;
* novo port;
* nova dependência;
* nova restrição;
* novo fluxo.

## Criar ou atualizar ADR

Somente quando houver decisão arquitetural.

## Criar relatório

Em:

```text
.ai/reports/
```

O relatório deve informar:

* tarefa;
* arquivos;
* implementação;
* testes;
* decisões;
* riscos;
* pendências.

## Atualizar coordenação

Quando utilizada:

```text
.ai/coordination/ACTIVE_TASKS.md
.ai/coordination/OWNERSHIP.md
.ai/coordination/DEPENDENCIES.md
.ai/coordination/INTEGRATION_QUEUE.md
```

O usuário não precisa realizar essas atualizações manualmente.

---

# 24. Quando o agente deve pedir aprovação humana

O agente deve parar antes de:

* alterar arquitetura;
* criar ou mudar ADR;
* adicionar dependência estrutural;
* escolher provedor externo;
* alterar contrato público;
* criar migration destrutiva;
* apagar dados;
* alterar autenticação;
* alterar autorização;
* alterar multi-tenancy;
* alterar fluxo financeiro;
* alterar cálculo de valores;
* alterar política de reembolso;
* executar deploy;
* executar operação em produção;
* acessar secrets;
* utilizar dados reais;
* executar ação irreversível.

O agente não deve interromper por:

* escolha de nome interno;
* organização local de arquivos;
* detalhes já definidos na arquitetura;
* implementação já determinada pela tarefa;
* testes comuns;
* decisões reversíveis e de baixo impacto.

---

# 25. O que nunca deve ser feito automaticamente

Nunca:

* realizar deploy;
* acessar produção;
* usar credenciais reais;
* apagar dados;
* executar migration destrutiva;
* realizar force push;
* alterar histórico compartilhado;
* modificar migration aplicada;
* desativar testes;
* remover validações para fazer build passar;
* esconder falhas;
* alterar contratos silenciosamente;
* adicionar funcionalidades fora do escopo;
* permitir que o implementador aprove o próprio trabalho.

---

# 26. Relatório final obrigatório

Ao concluir, o agente principal deve apresentar:

## Resultado

Resumo objetivo do que foi entregue.

## Tarefas concluídas

| Tarefa | Status | Responsável |
| ------ | ------ | ----------- |

## Subagentes utilizados

Informar os papéis utilizados.

## Arquivos relevantes alterados

Listar somente os mais importantes.

## Contratos

Informar contratos criados, consumidos ou alterados.

## Banco

Informar migrations, constraints e índices.

## Testes executados

| Comando | Resultado |
| ------- | --------- |

## Revisões realizadas

* revisão técnica;
* revisão de segurança;
* achados;
* correções.

## Validação global

Informar resultado final de:

* lint;
* typecheck;
* testes;
* build;
* arquitetura;
* migrations;
* secrets.

## Decisões tomadas

Listar decisões relevantes.

## Pendências

Listar pendências reais ou escrever:

```text
Nenhuma.
```

## Documentação atualizada

Informar os documentos alterados.

## Próxima etapa recomendada

Indicar somente uma próxima etapa clara.

---

# 27. Forma de uso pelo usuário

O usuário precisa usar apenas dois momentos.

## Momento 1 — Solicitação

```text
Leia `.ai/coordination/SIMPLE_USAGE.md` e siga exatamente o fluxo definido nele.

Quero implementar:

[DESCREVER O QUE DEVE SER FEITO]

Resultado esperado:

[DESCREVER O QUE PRECISA FUNCIONAR]

Regras importantes:

- [REGRA]
- [REGRA]

Fora do escopo:

- [ITEM]
- [ITEM]

Primeiro apresente o plano. Não implemente antes da minha aprovação.
```

## Momento 2 — Aprovação

```text
Plano aprovado.

Execute conforme o SIMPLE_USAGE.md.

Não aumente o escopo, não faça deploy e pare somente nos pontos que exigem aprovação humana.
```

O usuário não precisa fornecer instruções adicionais sobre agentes, branches, worktrees, revisores, integração ou testes.

---

# 28. Solicitação simples

Quando não houver muitos detalhes, o usuário pode escrever apenas:

```text
Leia `.ai/coordination/SIMPLE_USAGE.md`.

Quero implementar [FUNCIONALIDADE].

Primeiro apresente o plano.
```

O agente deve buscar no repositório as informações já existentes.

Só deve pedir esclarecimentos quando uma decisão de produto indispensável não puder ser obtida das fontes oficiais.

---

# 29. Regra de simplicidade

O agente principal deve esconder a complexidade operacional do usuário.

Não deve exigir que o usuário:

* coordene subagentes;
* acompanhe cada thread;
* crie branches;
* crie worktrees;
* edite arquivos de ownership;
* resolva conflitos;
* escolha testes;
* execute merges;
* atualize documentação manualmente.

O agente deve comunicar:

* plano;
* decisões importantes;
* riscos;
* resultado final.

Detalhes operacionais devem aparecer apenas quando:

* houver falha;
* houver conflito;
* houver risco;
* for necessária aprovação;
* o usuário solicitar.

---

# 30. Regra de ouro

> O usuário define o resultado. O agente principal planeja, delega, implementa, revisa, integra, valida e documenta.

O agente deve sempre preservar:

* escopo;
* arquitetura;
* segurança;
* multi-tenancy;
* concorrência;
* idempotência;
* testes;
* rastreabilidade;
* simplicidade para o usuário.
